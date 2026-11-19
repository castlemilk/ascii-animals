import { createSeahorseArtwork } from './runtime/public/seahorse.js';

const $ = id => document.getElementById(id);
const scenes = {
  'kelp-garden': {
    title: 'Eelgrass garden',
    description: 'The tail holds the blade as both sway in the current. Invite an inspection, release the grip, or brace against a surge.',
    options: {scene: 'kelp-garden', count: 3, choreography: 'cycle', duration: 28, stagger: .8, current: .3, scale: 1, palette: 'brass', behavior: 'curious', individuals: [{role: 'sentinel'}, {role: 'explorer'}, {role: 'dreamer'}]},
  },
  'tidal-duet': {
    title: 'Tidal duet',
    description: 'Two partners release their blades, rise together and return to their own holds.',
    options: {scene: 'tidal-duet', count: 2, choreography: 'cycle', duration: 30, stagger: .3, current: .15, scale: 1, palette: 'rose', behavior: 'curious', individuals: [{role: 'partner', facing: 'right'}, {role: 'partner', facing: 'left'}]},
  },
  'drift-passage': {
    title: 'Drift passage',
    description: 'One traveler opens its tail, drifts through the clearing and wraps the grass on return.',
    options: {scene: 'drift-passage', count: 1, choreography: 'cycle', duration: 26, stagger: 0, current: .45, scale: 1, palette: 'lagoon', behavior: 'curious', individuals: [{role: 'explorer'}]},
  },
  study: {
    title: 'A closer look',
    description: 'An upright portrait with room for every small detail: snout, crown, bony rings and spiral.',
    options: {scene: 'study', count: 1, choreography: 'hold', duration: 28, stagger: 0, current: .15, scale: 1, palette: 'brass', behavior: 'curious', individuals: [{role: 'sentinel'}]},
  },
};
const roles = {
  sentinel: 'Keeper · hold the grass',
  explorer: 'Explorer · venture out',
  dreamer: 'Dreamer · ride the current',
  partner: 'Partner · meet a neighbor',
};
const roleNotes = {
  sentinel: 'Holds the grass and leans into the current.',
  explorer: 'Loosens its tail to investigate nearby movement.',
  dreamer: 'Takes its time, drifting a little before settling.',
  partner: 'Keeps an eye on its companion across the clearing.',
};
const arcLabels = {
  arrival: 'Approaching the meadow', rest: 'Holding the blade',
  depart: 'Releasing into the current', return: 'Finding a hold again',
};
const motiveLabels = {
  hold: 'Holding the grass', holdfast: 'Holding the grass', anchored: 'Holding the grass',
  grip: 'Holding against the current', shelter: 'Taking shelter', startle: 'Taking shelter', startled: 'Bracing against the current',
  release: 'Loosening its tail', releasing: 'Loosening its tail',
  drift: 'Drifting through the garden', drifting: 'Drifting through the garden',
  inspect: 'Inspecting a visitor', inspecting: 'Inspecting a visitor', curious: 'Following a little curiosity',
  approach: 'Approaching a holdfast', arrive: 'Arriving quietly', arrival: 'Arriving quietly', arriving: 'Arriving quietly',
  recover: 'Settling back into the garden', recovering: 'Settling back into the garden',
  return: 'Returning to the grass', returning: 'Returning to the grass', anchor: 'Finding a hold',
  duet: 'Rising with a companion', rise: 'Rising with a companion',
  rest: 'Resting in the current', idle: 'Resting in the current',
};
const formatNumber = value => String(value + 1).padStart(2, '0');
const humanize = value => motiveLabels[value] ?? String(value).replaceAll('-', ' ').replace(/^./, ch => ch.toUpperCase());
const canvas = $('animal');
const compact = window.matchMedia('(max-width: 599px)');
const resolution = () => ({columns: compact.matches ? 100 : 160, rows: 76});
const initialResolution = resolution();
// A single visitor keeps the rings and tail legible on a phone. This is a
// scene preset only: resizing preserves any population the viewer has chosen.
function sceneOptions(id) {
  const preset = scenes[id].options;
  return compact.matches && id === 'kelp-garden'
    ? {...preset, count: 1, individuals: [preset.individuals[0]]}
    : preset;
}
canvas.style.setProperty('--stage-ratio', String(initialResolution.columns * .56 / initialResolution.rows));
const art = createSeahorseArtwork(canvas, {
  ...sceneOptions('kelp-garden'), ...initialResolution, labels: false,
});
let rosterSignature = '';
let selectedBefore = null;
let disposed = false;

function announce(message) {
  $('announcement').textContent = message;
}

function selectedMember(state = art.getDirectorState()) {
  return state.members.find(member => member.id === state.selected) ?? state.members[0];
}

function formatControl(key, value) {
  if (key === 'count') return String(value);
  if (key === 'current') return Math.abs(value) < .025 ? 'Still water' : Math.round(Math.abs(value) * 100) + '% ' + (value < 0 ? 'left' : 'right');
  if (key === 'duration') return Math.round(value) + ' s';
  if (key === 'stagger') return value.toFixed(1) + ' s';
  return value.toFixed(2) + '×';
}

function updateIndividual(id, key, value) {
  const state = art.getDirectorState();
  const index = state.members.findIndex(member => member.id === id);
  if (index < 0) return;
  const individuals = art.getOptions().individuals.map(member => ({...member}));
  while (individuals.length <= index) individuals.push({});
  individuals[index] = {...individuals[index], [key]: value};
  art.update({individuals});
  sync();
}

function buildRoster(state) {
  const signature = state.members.map(member => member.id).join(',');
  if (signature === rosterSignature) return;
  rosterSignature = signature;
  const fragment = document.createDocumentFragment();
  for (const member of state.members) {
    const card = document.createElement('article');
    card.className = 'visitor-card';
    card.id = 'visitor-' + member.id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'visitor-select';
    button.id = 'select-' + member.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      art.direct({type: 'select', id: member.id});
      sync();
      announce('Selected ' + (selectedMember()?.name ?? 'visitor ' + formatNumber(member.id)) + '. The gesture controls now direct this visitor.');
    });
    const number = document.createElement('span');
    number.className = 'visitor-number';
    number.textContent = formatNumber(member.id);
    const name = document.createElement('span');
    name.className = 'visitor-name';
    const title = document.createElement('strong');
    title.id = 'visitor-name-' + member.id;
    const subtitle = document.createElement('small');
    subtitle.id = 'visitor-location-' + member.id;
    name.append(title, subtitle);
    const check = document.createElement('span');
    check.className = 'visitor-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '●';
    button.append(number, name, check);
    const label = document.createElement('label');
    label.htmlFor = 'role-' + member.id;
    label.textContent = 'Visitor ' + formatNumber(member.id) + ' intention';
    const select = document.createElement('select');
    select.id = 'role-' + member.id;
    for (const [value, text] of Object.entries(roles)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.addEventListener('change', () => {
      updateIndividual(member.id, 'role', select.value);
      announce('Visitor ' + formatNumber(member.id) + ' is now a ' + (select.value === 'sentinel' ? 'keeper' : select.value) + '.');
    });
    const status = document.createElement('p');
    status.className = 'visitor-status';
    status.id = 'visitor-status-' + member.id;
    status.setAttribute('aria-live', 'off');
    card.append(button, label, select, status);
    fragment.append(card);
  }
  $('roster').replaceChildren(fragment);
}

function syncControls() {
  const options = art.getOptions();
  const study = options.scene === 'study';
  for (const key of ['count', 'current', 'speed', 'duration', 'stagger', 'scale']) {
    $(key).value = String(options[key]);
    $(key + '-value').textContent = formatControl(key, options[key]);
  }
  $('choreography').value = options.choreography;
  $('palette').value = options.palette;
  $('labels').checked = options.labels;
  for (const button of document.querySelectorAll('[data-scene]')) {
    const selected = options.scene === button.dataset.scene;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const key of ['release', 'anchor', 'startle', 'count', 'current', 'choreography', 'duration', 'stagger', 'member-scale', 'member-facing', 'labels']) {
    $(key).disabled = study;
  }
  for (const button of document.querySelectorAll('[data-beat]')) button.disabled = study;
  $('beat-hint').textContent = study ? 'Choose a garden scene to compose its story beats.' : 'Choose a beat. Each one pauses the scene.';
  $('keyboard-help').textContent = study
    ? 'On the focused artwork: Enter greets, Up/Down guide attention, Escape clears attention, Space pauses.'
    : 'On the focused artwork: Left/Right select, Up/Down guide attention, Enter inspects, R releases, H finds a hold, Escape clears attention, Space pauses.';
  $('gesture-hint').textContent = study ? 'The close study supports a greeting. Choose a garden scene to release, re-anchor or brace against the current.' : 'The other visitors keep their own intentions.';
  const scene = scenes[options.scene];
  $('scene-title').textContent = scene.title;
  $('scene-description').textContent = scene.description;
  canvas.setAttribute('aria-label', options.count + ' ASCII seahorse' + (options.count === 1 ? '' : 's') + ' in ' + scene.title.toLowerCase() + '. Use the labeled director controls to select a visitor, change its intention, or compose a still.');
}

function sync() {
  if (disposed) return;
  const status = art.getStatus();
  const state = art.getDirectorState();
  const options = art.getOptions();
  const still = status.paused;
  const study = options.scene === 'study';
  $('pause').disabled = status.reducedMotion;
  $('pause').textContent = status.reducedMotion ? 'Motion reduced' : still ? 'Play' : 'Pause';
  $('pause').setAttribute('aria-label', status.reducedMotion ? 'System reduced motion is active' : still ? 'Play the scene' : 'Pause the scene');
  $('playback-state').textContent = still ? 'STILL' : 'LIVE';
  $('live-dot').classList.toggle('still', still);
  $('presence-count').textContent = String(state.members.length).padStart(2, '0') + ' ' + (state.members.length === 1 ? 'VISITOR' : 'VISITORS');
  $('status').textContent = study ? humanize(status.phase) : options.choreography === 'hold' && state.arc === 'rest' ? 'Lingering in the garden' : arcLabels[state.arc];
  const progress = Math.max(0, Math.min(1, state.progress));
  $('progress-fill').style.transform = 'scaleX(' + progress + ')';
  $('scene-progress').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  $('scene-progress').setAttribute('aria-valuetext', arcLabels[state.arc] + ', ' + Math.round(progress * 100) + ' percent through the scene');
  $('scene-progress').hidden = study;
  for (const button of document.querySelectorAll('[data-beat]')) {
    button.classList.toggle('active', !study && still && state.arc === button.dataset.arc);
  }
  $('motion-note').textContent = status.reducedMotion
    ? 'Reduced motion: a still garden. Scene beats and visitor gestures change the pose without starting playback.'
    : still ? 'A deliberate still. Scene beats and visitor gestures change the composition. Play resumes the current.'
    : 'Stillness is always available. Pause, or compose one of the scene beats.';
  buildRoster(state);
  for (const member of state.members) {
    const selected = member.id === state.selected;
    $('visitor-' + member.id).classList.toggle('is-selected', selected);
    $('select-' + member.id).setAttribute('aria-pressed', String(selected));
    $('select-' + member.id).setAttribute('aria-label', 'Select visitor ' + formatNumber(member.id) + ', ' + member.name);
    $('visitor-name-' + member.id).textContent = member.name;
    $('visitor-location-' + member.id).textContent = study ? 'CLOSE STUDY' : member.anchorId === null ? 'IN OPEN WATER' : 'HOLDFAST ' + formatNumber(member.anchorId);
    $('visitor-status-' + member.id).textContent = study ? humanize(status.phase) : humanize(member.motive.kind);
    $('role-' + member.id).value = member.role;
    $('role-' + member.id).disabled = study;
  }
  const selected = selectedMember(state);
  if (selected) {
    $('selection-label').textContent = 'VISITOR ' + formatNumber(selected.id);
    $('selection-note').textContent = selected.name + '. ' + (study ? 'Invite a little attention and a curl of the tail.' : roleNotes[selected.role] ?? 'A quiet gesture for the selected visitor.');
    if (selectedBefore !== selected.id) {
      const index = state.members.findIndex(member => member.id === selected.id);
      const scale = options.individuals[index]?.scale ?? 1;
      $('member-scale').value = String(scale);
      $('member-facing').value = options.individuals[index]?.facing ?? 'auto';
      $('member-scale-value').textContent = formatControl('scale', scale);
      selectedBefore = selected.id;
    }
  }
}

for (const button of document.querySelectorAll('[data-scene]')) {
  button.addEventListener('click', () => {
    const scene = scenes[button.dataset.scene];
    art.update(sceneOptions(button.dataset.scene));
    art.restart();
    selectedBefore = null;
    syncControls();
    sync();
    announce(scene.title + '. ' + scene.description);
  });
}

for (const key of ['count', 'current', 'speed', 'duration', 'stagger', 'scale']) {
  $(key).addEventListener('input', () => {
    const value = Number($(key).value);
    art.update({[key]: value});
    $(key + '-value').textContent = formatControl(key, value);
    sync();
  });
}
for (const key of ['choreography', 'palette']) {
  $(key).addEventListener('change', () => {art.update({[key]: $(key).value}); sync();});
}
$('labels').addEventListener('change', () => {art.update({labels: $('labels').checked}); sync();});
$('member-facing').addEventListener('change', () => {
  const member = selectedMember();
  if (member) updateIndividual(member.id, 'facing', $('member-facing').value === 'auto' ? undefined : $('member-facing').value);
});
$('member-scale').addEventListener('input', () => {
  const member = selectedMember();
  if (!member) return;
  const value = Number($('member-scale').value);
  updateIndividual(member.id, 'scale', value);
  $('member-scale-value').textContent = formatControl('scale', value);
});
$('pause').addEventListener('click', () => {
  art.getStatus().paused ? art.play() : art.pause();
  sync();
  announce(art.getStatus().paused ? 'Scene paused.' : 'Scene playing.');
});
$('reset').addEventListener('click', () => {art.restart(); sync(); announce('Replayed this scene. Your settings and pause choice are preserved.');});
for (const [id, type, message] of [
  ['greet', 'inspect', 'An invitation to inspect.'],
  ['release', 'release', 'Uncoiling, drifting, then wrapping the grass again.'],
  ['anchor', 'anchor', 'Reaching for the grass, then finding a hold.'],
  ['startle', 'startle', 'Tightening the tail, leaning into the current, then recovering.'],
]) {
  $(id).addEventListener('click', () => {
    if (art.getOptions().scene === 'study') {
      if (type !== 'inspect') return;
      art.pulse();
    } else {
      art.direct({type});
    }
    sync();
    announce((selectedMember()?.name ?? 'The visitor') + ': ' + message);
  });
}
for (const button of document.querySelectorAll('[data-beat]')) {
  button.addEventListener('click', () => {
    art.pause();
    art.direct({type: 'seek', progress: Number(button.dataset.beat)});
    sync();
    announce(button.querySelector('strong').textContent + ' still composed. Playback remains paused.');
  });
}
$('capture').addEventListener('click', () => {
  $('text-frame').textContent = art.getFrame().text;
  $('capture-region').hidden = false;
  $('capture').setAttribute('aria-expanded', 'true');
  $('text-frame').focus({preventScroll: true});
  $('capture-region').scrollIntoView({behavior: 'auto', block: 'nearest'});
  announce('Captured the current character frame. The text is below the director.');
});
$('close-capture').addEventListener('click', () => {
  $('capture-region').hidden = true;
  $('capture').setAttribute('aria-expanded', 'false');
  $('capture').focus({preventScroll: true});
});
$('capture-png').addEventListener('click', () => {
  try {
    const link = document.createElement('a');
    link.download = 'seahorse-' + art.getOptions().scene + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    announce('PNG download requested for the current garden.');
  } catch {
    announce('PNG capture is unavailable in this browser. You can still capture the ASCII text.');
  }
});

function resizeResolution() {
  if (disposed) return;
  const grid = resolution();
  canvas.style.setProperty('--stage-ratio', String(grid.columns * .56 / grid.rows));
  art.update(grid);
  art.resize();
}
compact.addEventListener('change', resizeResolution);
// This timer only reads the scene for its labels; animation belongs to the artwork.
const statusTimer = window.setInterval(sync, 500);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true;
  window.clearInterval(statusTimer);
  compact.removeEventListener('change', resizeResolution);
  art.dispose();
});
syncControls();
sync();
