import { createOwlArtwork as mountOwl } from './runtime/public/owl.js';

// This demo owns controls only. The integrated artwork owns simulation and scheduling.
const byId = id => document.getElementById(id);
const host = byId('owl-host');
const announcement = byId('announcement');
const PRESETS = Object.freeze({
  lookout: Object.freeze({ scene: 'lookout', count: 2, layout: 'bough', tempo: 1,
    alertness: 0.72, sociability: 0.45, breeze: 0.25, autonomous: true,
    roles: Object.freeze(['sentinel', 'curious']) }),
  duet: Object.freeze({ scene: 'duet', count: 2, layout: 'split', tempo: 0.85,
    alertness: 0.45, sociability: 0.9, breeze: 0.18, autonomous: true,
    roles: Object.freeze(['sentinel', 'dreamer']) }),
  roost: Object.freeze({ scene: 'roost', count: 2, layout: 'close', tempo: 0.65,
    alertness: 0.25, sociability: 0.55, breeze: 0.1, autonomous: true,
    roles: Object.freeze(['dreamer', 'sentinel']) }),
});
const SCENES = Object.freeze({
  lookout: { name: 'Twilight lookout', phases: ['survey', 'listen', 'alert', 'settle'],
    labels: ['Survey', 'Listen', 'Alert', 'Settle'],
    description: 'A look across the treeline becomes a focused listen. Attention gathers, then opens out again.',
    hint: 'Move gently to meet a gaze. Tap an owl to rustle its perch.' },
  duet: { name: 'Call & answer', phases: ['call', 'answer', 'shared-watch', 'settle'],
    labels: ['Call', 'Answer', 'Shared watch', 'Settle'],
    description: 'A cue crosses the space between them. One owl leads; its companion answers a little later, then both watch the night.',
    hint: 'Call to one owl. Watch its companion answer across the perch.' },
  roost: { name: 'Last light', phases: ['survey', 'stretch', 'rest', 'wake'],
    labels: ['Last look', 'Stretch', 'Rest', 'Stir'],
    description: 'A final look, a slow unfolding of feathers, then heavy eyelids. The night continues around them.',
    hint: 'A soft cue can interrupt the quiet. Let the owls find their way back to rest.' },
});
const PHASE_LABELS = {
  survey: 'Surveying the treeline', listen: 'Listening closely', alert: 'Attention gathered',
  settle: 'Finding their quiet', call: 'A call across the perch', answer: 'An answering turn',
  'shared-watch': 'Keeping watch together', stretch: 'Unfolding the wings', rest: 'Heavy eyelids',
  wake: 'Stirring again', focus: 'Finding the sound', recover: 'Returning to the scene',
  launch: 'Gathering for takeoff', glide: 'Holding the quiet air',
  brake: 'Opening the wings to brake', alight: 'Finding the bough again',
};
const FLIGHT_ARC = Object.freeze({
  phases: ['launch', 'glide', 'brake', 'alight'],
  labels: ['Launch', 'Glide', 'Brake', 'Alight'],
  description: 'The owl gathers its weight, lifts from the branch, then glides. Spread wings and reaching feet slow the return before the feathers settle.',
});
const DIRECTIONS = { left: [-0.85, 0], up: [0, -0.75], down: [0, 0.75], right: [0.85, 0] };
const humanize = value => String(value ?? 'Quietly perched').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
let controller;
let lastPolicy;
let currentConfig = PRESETS.lookout;
let controlsSignature = '';
let currentGuide = { x: 0, y: 0 };

function selectedTarget() {
  const value = byId('target').value;
  return value === '1' && currentConfig.count === 2 ? 1 : 0;
}

function syncDirectorControls(config) {
  currentConfig = config;
  const signature = JSON.stringify(config);
  if (signature === controlsSignature) return;
  controlsSignature = signature;
  document.body.dataset.scene = config.scene;
  document.querySelectorAll('.scene-choice[data-scene]').forEach(button => {
    const selected = button.dataset.scene === config.scene;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-count]').forEach(button => {
    const selected = Number(button.dataset.count) === config.count;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const solo = config.count === 1;
  byId('ember-card').hidden = solo;
  document.querySelector('.cast-cards').classList.toggle('solo', solo);
  byId('target-ember').disabled = solo;
  if (solo && byId('target').value === '1') byId('target').value = '0';
  byId('layout').value = config.layout;
  byId('layout').disabled = solo;
  byId('layout-help').textContent = solo ? 'Add a companion to arrange the space between them.'
    : 'Where they sit changes how their attention meets.';
  byId('sociability').disabled = solo;
  byId('cast-note').textContent = solo
    ? 'A quiet solo. Ember returns with the same selected disposition when you choose Duet.'
    : 'Changing a disposition changes who notices, who follows, and who takes their time.';
  byId('cast-label').textContent = solo ? 'ONE OWL' : 'TWO OWLS';
  for (let id = 0; id < 2; id++) byId(`role-${id}`).value = config.roles[id];
  for (const key of ['tempo', 'alertness', 'sociability', 'breeze']) {
    byId(key).value = String(config[key]);
    byId(`${key}-value`).value = key === 'tempo' ? `${config[key].toFixed(2)}×` : `${Math.round(config[key] * 100)}%`;
  }
  byId('autonomous').checked = config.autonomous;
}

function showDirector(state, status) {
  if (!state) return;
  syncDirectorControls(state.config);
  const scene = SCENES[state.config.scene];
  const phase = state.phase.kind;
  const flight = state.cue?.kind === 'flight' || FLIGHT_ARC.phases.includes(phase);
  const arc = flight ? FLIGHT_ARC : scene;
  const index = arc.phases.indexOf(phase);
  byId('behavior').textContent = `${status.running ? '' : 'Still · '}${PHASE_LABELS[phase] ?? humanize(phase)}`;
  byId('scene-description').textContent = arc.description;
  byId('scene-hint').textContent = status.running ? scene.hint : 'This moment is held. Give a cue to choose a deliberate still pose.';
  byId('phase-counter').textContent = index < 0 ? 'RESPONDING' : `${String(index + 1).padStart(2, '0')} / 04`;
  const steps = byId('scene-arc').children;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    step.querySelector('.arc-label').textContent = arc.labels[i];
    step.classList.toggle('current', i === index);
    step.classList.toggle('complete', index >= 0 && i < index);
    if (i === index) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
  }
  for (const actor of state.actors) {
    byId(`intent-${actor.id}`).textContent = humanize(actor.motive);
  }
}

function statusChanged(status) {
  byId('pause-label').textContent = status.paused ? 'Play' : 'Pause';
  byId('pause-symbol').textContent = status.paused ? '▷' : 'Ⅱ';
  byId('pause').setAttribute('aria-pressed', String(status.paused));
  byId('mode').textContent = status.running ? 'LIVE' : status.paused ? 'PAUSED' : 'STILL';
  byId('status-dot').classList.toggle('still', !status.running);
  byId('grid-label').textContent = `${status.cols} × ${status.rows} · TEXT CELLS`;
  showDirector(status.director, status);
  let message = currentConfig.autonomous
    ? 'Give a cue, then let the response settle. Pause holds the moment without changing the pose.'
    : 'Scene direction is on hold. Send a cue or let the night unfold again.';
  if (status.blockedBy.includes('reduced-motion')) message = 'Reduced motion is on. Scene choices, gaze and cues select still poses. Play will respect this preference.';
  else if (status.blockedBy.includes('small-container')) message = 'This small display uses still poses. Scene choices, gaze and cues remain available.';
  else if (status.blockedBy.includes('motion-preference-unavailable') || status.blockedBy.includes('animation-unavailable')) message = 'This browser is using still poses. Scene choices, gaze and cues remain available.';
  else if (status.paused) message = 'Paused at this moment. Gaze and cues choose still poses. Restart and scene changes keep this pause.';
  else if (!status.running) message = 'The scene rests while it is hidden or outside the view.';
  byId('policy').textContent = message;
  const policy = status.blockedBy.join(',');
  if (lastPolicy !== undefined && policy !== lastPolicy) announcement.textContent = message;
  lastPolicy = policy;
}

function action(callback) {
  if (!controller || controller.getStatus().disposed) return;
  try { callback(); }
  catch (error) {
    // Failed validated updates retain the prior configuration; restore the visible controls.
    controlsSignature = '';
    if (!controller.getStatus().disposed) statusChanged(controller.getStatus());
    announcement.textContent = `That change could not be applied: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function announceCue(kind, result) {
  const target = selectedTarget();
  const name = target === 0 ? 'Ash' : 'Ember';
  const descriptions = {
    rustle: `${name} receives a rustle at the guided position.`,
    call: `${name} receives a call. A companion can answer in its own time.`,
    stretch: `${name} is invited to unfold its wings.`,
    flight: `${name} is invited to launch, glide and return to its perch.`,
  };
  announcement.textContent = result.kind === 'poster'
    ? `${descriptions[kind]} A still response is displayed; motion remains stopped.`
    : `${descriptions[kind]} If a response is already underway, this cue can be ignored. Let it settle before trying again.`;
}

function cue(kind) {
  action(() => {
    const target = selectedTarget();
    const result = controller.cue({ kind, x: currentGuide.x, y: currentGuide.y, target });
    announceCue(kind, result);
  });
}

function guide(direction) {
  action(() => {
    const [x, y] = DIRECTIONS[direction];
    currentGuide = { x, y };
    const target = selectedTarget();
    const result = controller.guide(x, y, target);
    announcement.textContent = `Gaze guided ${direction}.${result.kind === 'poster' ? ' A still pose is displayed.' : ''}`;
  });
}

function releaseAttention() {
  action(() => {
    controller.leave();
    currentGuide = { x: 0, y: 0 };
    announcement.textContent = 'Attention released. The owls return to their scene.';
  });
}

function togglePause() {
  action(() => {
    controller.setPaused(!controller.getStatus().paused);
    const status = controller.getStatus();
    announcement.textContent = status.paused ? 'This moment is paused.' : status.running ? 'The scene is playing.' : byId('policy').textContent;
  });
}

function showStoppedScenePose() {
  if (controller.getStatus().running) return;
  if (currentConfig.scene === 'roost') controller.leave();
  else if (currentConfig.scene === 'duet') controller.cue({ kind: 'call', target: 0 });
  else controller.guide(-0.65, -0.25, 0);
}

function selectScene(key) {
  action(() => {
    const preset = PRESETS[key];
    controller.updateDirector({ ...preset, roles: [...preset.roles] });
    controller.reset(7);
    currentGuide = { x: 0, y: 0 };
    byId('target').value = '0';
    showStoppedScenePose();
    announcement.textContent = `${SCENES[key].name}, from the beginning. Roles and perch composition are set.${controller.getStatus().paused ? ' Motion remains paused.' : ''}`;
  });
}

try {
  controller = mountOwl(host, {
    owl: { seed: 7, reactionStrength: 0.85 },
    director: { ...PRESETS.lookout, roles: [...PRESETS.lookout.roles] },
    onStatus: statusChanged,
  });
  showStoppedScenePose();
  byId('fallback').hidden = true;
  // Deliberate demo diagnostics for replay/review; not a library global API.
  window.owlDemo = Object.freeze({ controller, host });
} catch (error) {
  byId('mode').textContent = 'UNAVAILABLE';
  announcement.textContent = `The description remains available. ${error instanceof Error ? error.message : String(error)}`;
  for (const element of document.querySelectorAll('button,select,input')) element.disabled = true;
  host.removeAttribute('tabindex');
}

for (const button of document.querySelectorAll('.scene-choice[data-scene]')) button.addEventListener('click', () => selectScene(button.dataset.scene));
for (const button of document.querySelectorAll('[data-count]')) button.addEventListener('click', () => action(() => {
  const count = Number(button.dataset.count);
  if (count === 1) byId('target').value = '0';
  controller.updateDirector({ count });
  announcement.textContent = count === 1 ? 'Ash keeps a solo watch.' : 'Ember rejoins the perch.';
}));
for (const select of document.querySelectorAll('[data-role]')) select.addEventListener('change', event => action(() => {
  const id = Number(event.target.dataset.role);
  const roles = [...currentConfig.roles];
  roles[id] = event.target.value;
  controller.updateDirector({ roles });
  announcement.textContent = `${id === 0 ? 'Ash' : 'Ember'} now has a ${event.target.value} disposition.`;
}));
byId('layout').addEventListener('change', event => action(() => {
  controller.updateDirector({ layout: event.target.value });
  announcement.textContent = 'Perch composition changed. The scene keeps its place in time.';
}));
for (const key of ['tempo', 'alertness', 'sociability', 'breeze']) byId(key).addEventListener('input', event => action(() => {
  controller.updateDirector({ [key]: Number(event.target.value) });
}));
byId('autonomous').addEventListener('change', event => action(() => {
  controller.updateDirector({ autonomous: event.target.checked });
  announcement.textContent = event.target.checked ? 'Autonomous scene direction is on.' : 'Scene direction is held. Your cues remain available.';
}));
byId('head-limit').addEventListener('input', event => action(() => {
  const value = Number(event.target.value);
  controller.update({ headYawLimitDeg: value });
  byId('head-value').value = `${value}°`;
}));
byId('reaction').addEventListener('input', event => action(() => {
  const value = Number(event.target.value);
  controller.update({ reactionStrength: value / 100 });
  byId('reaction-value').value = `${value}%`;
}));
byId('pause').addEventListener('click', togglePause);
byId('reset').addEventListener('click', () => action(() => {
  controller.reset(7);
  currentGuide = { x: 0, y: 0 };
  showStoppedScenePose();
  announcement.textContent = `This scene starts again with the same settings.${controller.getStatus().paused ? ' Motion remains paused.' : ''}`;
}));
for (const kind of ['rustle', 'flight', 'call', 'stretch']) byId(kind).addEventListener('click', () => cue(kind));
for (const button of document.querySelectorAll('[data-cue]')) button.addEventListener('click', () => cue(button.dataset.cue));
for (const button of document.querySelectorAll('[data-guide]')) button.addEventListener('click', () => guide(button.dataset.guide));
byId('release').addEventListener('click', releaseAttention);
host.addEventListener('keydown', event => {
  if (event.target !== host || event.altKey || event.ctrlKey || event.metaKey || event.isComposing || !controller) return;
  const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[event.key];
  if (direction) { event.preventDefault(); guide(direction); return; }
  const key = event.key.toLowerCase();
  if (!['enter', 'r', 'f', 'c', 's', ' ', 'escape'].includes(key)) return;
  event.preventDefault();
  if (event.repeat) return;
  if (key === 'enter' || key === 'r') cue('rustle');
  else if (key === 'f') cue('flight');
  else if (key === 'c') cue('call');
  else if (key === 's') cue('stretch');
  else if (key === ' ') togglePause();
  else releaseAttention();
});

function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  try {
    anchor.href = url; anchor.download = name;
    document.body.appendChild(anchor); anchor.click();
  } finally { anchor.remove(); URL.revokeObjectURL(url); }
}
byId('download').addEventListener('click', () => action(() => {
  const status = controller.getStatus();
  download(controller.exportText() + '\n', 'text/plain;charset=utf-8',
    `owl-${currentConfig.scene}-${String(status.tick).padStart(5, '0')}.txt`);
  announcement.textContent = 'The exact displayed text frame is ready to download.';
}));
byId('download-setup').addEventListener('click', () => action(() => {
  const snapshot = controller.getSnapshot();
  const setup = { schemaVersion: 1, species: 'owl', seed: snapshot.simulation.config.seed,
    owl: snapshot.simulation.config, director: currentConfig,
    note: 'Configuration only. Recreate with createOwlArtwork(element, { owl, director }); this is not a recorded input replay or a saved simulation state.' };
  download(JSON.stringify(setup, null, 2) + '\n', 'application/json', `owl-${currentConfig.scene}-director.json`);
  announcement.textContent = 'Director settings are ready to download. This saves configuration, not a recording.';
}));
const refreshText = () => action(() => { byId('text-output').value = controller.exportText(); });
byId('text-frame').addEventListener('toggle', event => { if (event.target.open) refreshText(); });
byId('refresh-text').addEventListener('click', () => { refreshText(); announcement.textContent = 'Selectable text frame refreshed.'; });
window.addEventListener('pagehide', event => { if (!event.persisted) controller?.dispose(); });
