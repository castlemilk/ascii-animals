import { createTurtleArtwork } from './runtime/public/turtle.js';

const $ = id => document.getElementById(id);
const scenes = {
  'reef-passage': { title: 'Reef passage', description: 'Travelers trace the shelf at different depths, each keeping a different rhythm.' },
  'seagrass-stop': { title: 'Seagrass stop', description: 'An unhurried stop above the meadow. An inspection becomes a bank, then a return.' },
  'blue-drift': { title: 'Blue drift', description: 'Quiet water, long glides, and a small change of direction toward the light.' },
  study: { title: 'The solo study', description: 'One green turtle: a curved scuted shell, four attached paddles, and a patient glide.' }
};
const actNames = { arrival: 'Arriving', linger: 'Lingering', departure: 'Departing', complete: 'Passage complete', study: 'Solo study' };
const formatCurrent = value => Math.abs(value) < .01 ? 'Still water' : `${value < 0 ? 'West' : 'East'} · ${Math.round(Math.abs(value) * 100)}%`;
const titleCase = value => value.charAt(0).toUpperCase() + value.slice(1);
const numericOptions = ['count', 'current', 'depth', 'spacing', 'speed', 'scale', 'arrivalSeconds', 'lingerSeconds', 'departureSeconds'];
const selectOptions = ['route', 'director', 'palette', 'facing', 'behavior'];
// Choose legible cells at mount without changing the grid during a gesture.
const compact = window.matchMedia('(max-width: 620px)').matches;
const initial = { scene: 'reef-passage', count: compact ? 1 : 3, columns: compact ? 100 : 160, rows: compact ? 40 : 64, showLabels: true, palette: 'brass' };
const rosterButtons = [];
let art, unsubscribe, restorePlayback = false;

function announce(message) { $('announcement').textContent = message; }
function valueLabel(key, value) {
  if (key === 'count') return String(value);
  if (key === 'current') return formatCurrent(value);
  if (key === 'depth') return `${Math.round(value * 100)}%`;
  if (key.endsWith('Seconds')) return `${value}s`;
  return `${value.toFixed(2)}×`;
}

function updateRoster(director) {
  while (rosterButtons.length < director.members.length) {
    const id = rosterButtons.length, button = document.createElement('button');
    const number = document.createElement('span'), details = document.createElement('span');
    const name = document.createElement('span'), role = document.createElement('span'), motion = document.createElement('span');
    number.className = 'member-number'; name.className = 'member-name'; role.className = 'member-role'; motion.className = 'member-motion';
    number.textContent = String(id + 1).padStart(2, '0');
    details.append(name, role, motion); button.append(number, details);
    button.type = 'button'; button.dataset.member = String(id);
    button.addEventListener('click', () => perform(() => { art.select(id); announce(`${name.textContent} selected.`); }));
    $('roster').append(button); rosterButtons.push({ button, name, role, motion });
  }
  while (rosterButtons.length > director.members.length) rosterButtons.pop().button.remove();
  director.members.forEach((member, index) => {
    const item = rosterButtons[index];
    item.name.textContent = member.label;
    item.role.textContent = titleCase(member.role);
    item.motion.textContent = titleCase(member.motion);
    item.button.setAttribute('aria-pressed', String(member.id === director.selectedId));
    item.button.setAttribute('aria-label', `${member.label}, ${member.role}. ${member.motion}. Select traveler ${member.id + 1}.`);
  });
}

function sync() {
  if (!art || art.disposed) return;
  const status = art.getStatus(), director = art.getDirectorState(), options = art.getOptions();
  const scene = scenes[director.scene], still = status.paused;
  $('scene-title').textContent = scene.title;
  $('scene-description').textContent = scene.description;
  $('status').textContent = `${still ? 'STILL / ' : ''}${actNames[director.phase].toUpperCase()}`;
  $('pause').disabled = status.reducedMotion;
  $('pause').textContent = status.reducedMotion ? 'Motion reduced' : options.paused ? 'Play passage' : 'Pause passage';
  $('pause').setAttribute('aria-pressed', String(options.paused || status.reducedMotion));
  $('motion-note').textContent = status.reducedMotion
    ? 'Reduced motion: a deliberate still scene. Choose an act or invite an inspection to change the pose; playback stays still.'
    : still ? 'Paused. Choose an act, change a motive, or invite an inspection to compose a still.'
      : 'Pause to compose a still. Scene acts and inspections stay available.';
  $('cycle-label').textContent = director.scene === 'study' ? 'SINGLE STUDY' : `PASSAGE ${String(director.cycle + 1).padStart(2, '0')}`;
  $('act-progress').value = Math.max(0, Math.min(1, director.progress));
  $('act-progress').setAttribute('aria-label', `Progress through ${actNames[director.phase].toLowerCase()}`);
  $('act-note').textContent = director.phase === 'complete'
    ? 'The passage is complete. Start again, choose an act, or switch to a repeating passage.'
    : director.scene === 'study' ? 'Choose an authored scene above to give this study an arrival, a stay, and a departure.'
      : 'Choose an act to compose its moment. Your pause choice stays in place.';
  $('current-caption').textContent = `CURRENT / ${formatCurrent(options.current).toUpperCase()}`;
  document.querySelectorAll('[data-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === director.scene)));
  document.querySelectorAll('[data-act]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.act === director.phase));
    button.disabled = director.scene === 'study';
  });
  for (const key of numericOptions) { $(key).value = String(options[key]); $(key + '-value').textContent = valueLabel(key, options[key]); }
  for (const key of selectOptions) $(key).value = options[key];
  for (const key of ['showLabels', 'showRoute']) $(key).checked = options[key];
  for (const key of ['count', 'current', 'depth', 'spacing', 'route', 'director', 'showLabels', 'showRoute', 'individual-role', 'individual-size', 'individual-interest', 'arrivalSeconds', 'lingerSeconds', 'departureSeconds']) $(key).disabled = director.scene === 'study';
  updateRoster(director);
  const selected = director.members.find(member => member.id === director.selectedId);
  if (selected) {
    $('individual-title').textContent = selected.label;
    $('cue-help').textContent = `${selected.label} · ${selected.motion === 'surfacing' ? 'rising for air' : selected.motion === 'banking' && selected.reaction.kind !== 'none' ? 'diving' : selected.motion}. ${selected.reaction.kind === 'none' ? 'Ready for your cue.' : 'Let this movement finish.'}`;
    $('individual-status').textContent = `${titleCase(selected.role)} / ${titleCase(selected.motion)}`;
    $('individual-role').value = selected.role;
    $('individual-size').value = String(selected.size);
    $('individual-size-value').textContent = `${selected.size.toFixed(2)}×`;
    $('individual-interest').value = String(selected.interest);
    $('individual-interest-value').textContent = `${Math.round(selected.interest * 100)}%`;
    $('inspect').textContent = `Invite ${selected.label}`;
  }
}

function perform(action) {
  if (!art || art.disposed) return;
  try { action(); $('error').hidden = true; sync(); }
  catch (error) { $('error').hidden = false; $('error').textContent = `This change could not be applied: ${error instanceof Error ? error.message : 'Unknown error'}`; }
}
function updateIndividual(patch) {
  const selectedId = art.getDirectorState().selectedId;
  const overrides = art.getOptions().individuals.map(item => ({ ...item }));
  const index = overrides.findIndex(item => item.id === selectedId);
  if (index < 0) overrides.push({ id: selectedId, ...patch });
  else overrides[index] = { ...overrides[index], ...patch };
  art.update({ individuals: overrides });
}

document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => perform(() => {
  art.direct(button.dataset.scene); art.stage('arrival');
  announce(`${scenes[button.dataset.scene].title}. ${art.getStatus().paused ? 'Still composition.' : 'Passage begins.'}`);
})));
document.querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', () => perform(() => {
  art.stage(button.dataset.act); announce(`${actNames[button.dataset.act]} tableau selected.`);
})));
$('pause').addEventListener('click', () => perform(() => { art.getOptions().paused ? art.play() : art.pause(); announce(art.getStatus().paused ? 'Passage paused.' : 'Passage playing.'); }));
$('reset').addEventListener('click', () => perform(() => { art.restart(); announce('Passage restarted. Your pause choice is preserved.'); }));
for (const [id, y, message] of [['surface', -.9, 'Surface breath invited.'], ['dive', .9, 'Dive and recovery invited.']]) {
  $(id).addEventListener('click', () => perform(() => {
    const director = art.getDirectorState(), member = director.members[director.selectedId];
    art.inspect(Math.max(-1, Math.min(1, member.x)), y, member.id);
    announce(`${message} ${art.getStatus().paused ? 'Still pose selected.' : 'The current cue completes before another begins.'}`);
  }));
}
$('inspect').addEventListener('click', () => perform(() => { art.pulse(); announce('Inspection invited for the selected traveler.'); }));
$('clear-guide').addEventListener('click', () => perform(() => { art.clearGuide(); announce('Guide cleared.'); }));
$('classic').addEventListener('click', () => perform(() => { art.direct('study'); announce('Solo study selected.'); }));
for (const key of numericOptions) $(key).addEventListener('input', () => perform(() => art.update({ [key]: Number($(key).value) })));
for (const key of selectOptions) $(key).addEventListener('change', () => perform(() => art.update({ [key]: $(key).value })));
for (const key of ['showLabels', 'showRoute']) $(key).addEventListener('change', () => perform(() => art.update({ [key]: $(key).checked })));
$('individual-role').addEventListener('change', () => perform(() => updateIndividual({ role: $('individual-role').value })));
$('individual-size').addEventListener('input', () => perform(() => updateIndividual({ size: Number($('individual-size').value) })));
$('individual-interest').addEventListener('input', () => perform(() => updateIndividual({ interest: Number($('individual-interest').value) })));
$('capture').addEventListener('click', () => perform(() => {
  $('text-frame').textContent = art.getFrame().text;
  $('capture-region').hidden = false; $('text-frame').focus(); announce('Current character frame captured below.');
}));
$('close-capture').addEventListener('click', () => { $('capture-region').hidden = true; $('capture').focus(); });
$('download-png').addEventListener('click', () => perform(() => {
  const link = document.createElement('a');
  link.href = $('animal').toDataURL('image/png'); link.download = `turtle-${art.getOptions().scene}.png`;
  link.hidden = true; document.body.append(link); link.click(); link.remove();
  announce('Canvas PNG prepared for download.');
}));

function dispose() { unsubscribe?.(); unsubscribe = undefined; art?.dispose(); }
window.addEventListener('pagehide', event => {
  if (event.persisted && art && !art.disposed) { restorePlayback = !art.getOptions().paused; art.pause(); }
  else dispose();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && art && !art.disposed) { if (restorePlayback) art.play(); restorePlayback = false; sync(); }
});
try {
  art = createTurtleArtwork($('animal'), initial);
  art.stage('arrival');
  unsubscribe = art.subscribe(sync);
  sync();
} catch (error) {
  dispose(); $('error').hidden = false;
  $('error').textContent = `The turtle scene could not start: ${error instanceof Error ? error.message : 'Canvas is unavailable'}. The scene descriptions and controls remain readable.`;
  document.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
}
