import { createFrogArtwork } from '../../../../../lib/public/frog.js';
import { createSpringPeaArtwork } from '../index.mjs';
import { createVisibleActionRunner } from './visible-action.mjs';

const $ = id => document.getElementById(id);
const canvas = $('frog'), status = $('status'), pause = $('pause'), landing = $('landing');
const params = new URLSearchParams(location.search);
const settings = Object.freeze({ seed: 23, director: Object.freeze({ scene: 'stillwater', count: 1, autonomy: false, layout: 'shelter', roles: ['hunter', 'hunter', 'dreamer'] }), preview: Object.freeze({ cols: 96, rows: 60, labels: false, trajectories: false, renderFps: 30 }) });
const aims = Object.freeze({ 'upper-right': { x: .36, y: -.4 }, 'upper-left': { x: -.76, y: -.7 }, 'lower-right': { x: .36, y: .7 } });
const factories = { original: createFrogArtwork, 'spring-pea-r2': createSpringPeaArtwork };
const cleanups = [], actionLog = [];
let controller = null, visibility = null, disposed = false, mountGeneration = 0;
let mode = params.get('renderer') === 'original' ? 'original' : 'spring-pea-r2';
let explicitPause = params.get('paused') === '1', lastPhase = '', lastPadSignature = '', lastObservedPhase = '';
let mounts = 0, disposals = 0;

function on(target, event, handler) { target.addEventListener(event, handler); cleanups.push(() => target.removeEventListener(event, handler)); }
function say(message) { status.textContent = message; }
function record(type, detail = {}) {
  actionLog.push({ renderer: mode, tick: controller?.getStatus().tick ?? 0, type, ...detail });
  if (actionLog.length > 512) actionLog.shift();
}
function phaseOf(pond) {
  const actor = pond.actors.find(item => item.id === pond.selectedId);
  return actor.model.behavior.kind === 'idle' || actor.model.behavior.kind === 'interest' ? actor.motive.kind : actor.model.behavior.kind;
}
function syncStatus() {
  if (!controller || disposed) return;
  const state = controller.getStatus();
  pause.textContent = state.paused ? 'Play' : 'Pause';
  pause.setAttribute('aria-label', state.paused ? 'Play frog motion' : 'Pause frog motion');
  $('motion').textContent = state.reducedMotion ? 'Reduced motion · stills only' : state.paused ? 'Paused' : 'Motion follows your system';
  $('motion').dataset.reducedMotion = String(state.reducedMotion);
}
function syncScene(pond) {
  const actor = pond.actors.find(item => item.id === pond.selectedId);
  const phase = phaseOf(pond);
  const labels = { rest: 'RESTING', interest: 'AIMING', idle: 'RESTING', listen: 'LISTENING', crouch: 'LOADING', flight: 'AIRBORNE', landing: 'CONTACT', recovery: 'RECOVERING', cooldown: 'SETTLING', track: 'WATCHING', hop: 'APPROACHING', strike: 'SNAP', settle: 'SETTLING', call: 'CALLING' };
  if (phase !== lastPhase) { $('phase').textContent = labels[phase] ?? phase.toUpperCase(); lastPhase = phase; }
  const observed = `${phase}:${pond.firefly?.phase ?? ''}`;
  if (observed !== lastObservedPhase) {
    lastObservedPhase = observed;
    record('phase', { simulationTick: pond.tick, phase, padId: actor.padId, position: actor.model.position, firefly: pond.firefly?.phase ?? null });
  }
  const busy = !['idle', 'interest'].includes(actor.model.behavior.kind) || !['rest', 'listen'].includes(actor.motive.kind);
  landing.disabled = busy;
  $('leap').disabled = busy;
  $('hunt').disabled = busy;
  if (!busy) {
    const pads = pond.pads.filter(pad => !pond.actors.some(other => other.padId === pad.id || other.reservedPad === pad.id) && Math.hypot(pad.point.x - actor.model.position.x, pad.point.y - actor.model.position.y) <= actor.model.config.maxDistance + 1e-10);
    const signature = pads.map(pad => pad.id).join(',');
    if (signature !== lastPadSignature) {
      const previous = landing.value;
      landing.replaceChildren(...pads.map(pad => { const option = document.createElement('option'); option.value = String(pad.id); option.textContent = `${pad.label} · ${pad.point.x < actor.model.position.x ? 'left' : 'right'}`; return option; }));
      if (pads.some(pad => String(pad.id) === previous)) landing.value = previous;
      lastPadSignature = signature;
    }
    $('leap').disabled = pads.length === 0;
  }
  syncStatus();
}
function mount(renderer) {
  if (disposed) return;
  const old = controller;
  explicitPause = old ? old.getStatus().paused : explicitPause;
  visibility?.dispose(); visibility = null;
  if (old) { old.dispose(); disposals++; }
  controller = null;
  mode = renderer; mountGeneration++;
  const generation = mountGeneration;
  lastPhase = ''; lastPadSignature = ''; lastObservedPhase = '';
  $('renderer-label').textContent = mode === 'original' ? 'ORIGINAL / CURRENT MAIN' : 'SPRING PEA R2';
  document.body.dataset.renderer = mode;
  document.querySelector(`input[name="renderer"][value="${mode}"]`).checked = true;
  $('pose').value = '';
  try {
    controller = factories[mode](canvas, { ...settings, paused: explicitPause, preview: { ...settings.preview, view: $('view').value, silhouette: $('silhouette').checked },
      onAction(message) { if (generation !== mountGeneration || disposed) return; say(message); record('notice', { message }); syncStatus(); },
      onPondChange(pond) { if (generation === mountGeneration && !disposed) syncScene(pond); },
    });
    mounts++;
    visibility = createVisibleActionRunner({ canvas, controller, view: window, document, announce: say });
    canvas.hidden = false; $('fallback').hidden = true;
    record('mount', { seed: settings.seed, paused: explicitPause });
    syncScene(controller.getPondState()); syncStatus();
    say(explicitPause ? 'Paused. Play the frog or choose a still pose.' : 'Choose a pad, then startle the frog.');
  } catch (error) {
    canvas.hidden = true; $('fallback').hidden = false;
    say(`The study could not start: ${error.message}`);
    for (const control of document.querySelectorAll('button,select,input')) control.disabled = true;
    throw error;
  }
}
function cancelPending() { visibility?.cancel(); }
function runVisible(action) { visibility?.run(() => { if (!disposed && controller && !controller.getStatus().disposed) action(); }); }

for (const input of document.querySelectorAll('input[name="renderer"]')) on(input, 'change', () => { if (input.checked) mount(input.value); });
for (const input of document.querySelectorAll('input[name="moment"]')) on(input, 'change', () => {
  if (!input.checked) return;
  cancelPending();
  $('leap-controls').hidden = input.value !== 'leap'; $('hunt-controls').hidden = input.value !== 'hunt';
  say(input.value === 'leap' ? 'Choose a reachable landing pad.' : 'Choose where the firefly should lead the frog.');
});
on(landing, 'change', cancelPending); on($('lure'), 'change', cancelPending);
on($('leap'), 'click', () => {
  const pad = controller.getPondState().pads.find(item => String(item.id) === landing.value);
  if (!pad) return;
  const point = { ...pad.point };
  runVisible(() => { record('leap', { requestedPadId: pad.id, point }); controller.target(point); controller.leap(); syncStatus(); });
});
on($('hunt'), 'click', () => {
  const aim = $('lure').value, point = { ...aims[aim] };
  runVisible(() => { record('hunt', { aim, point }); controller.hunt(point); syncStatus(); });
});
on(pause, 'click', () => { cancelPending(); explicitPause = !controller.getStatus().paused; controller.setPaused(explicitPause); record('pause', { paused: explicitPause }); $('pose').value = ''; syncStatus(); say(explicitPause ? 'Paused. The current pose stays still.' : 'Playing. Choose a landing or lure a firefly.'); });
on($('reset'), 'click', () => { cancelPending(); controller.reset(); $('pose').value = ''; record('reset'); syncStatus(); });
on($('pose'), 'change', () => {
  cancelPending(); const pose = $('pose').value;
  if (pose) { controller.setStaticPose(pose); record('still', { pose }); }
  else { controller.reset(); record('reset'); }
  syncStatus();
});
on($('view'), 'change', () => { controller.updatePreview({ view: $('view').value }); record('view', { view: $('view').value }); });
on($('silhouette'), 'change', () => { controller.updatePreview({ silhouette: $('silhouette').checked }); record('silhouette', { enabled: $('silhouette').checked }); });

function snapshot() {
  const pond = controller?.getPondState(), actor = pond?.actors.find(item => item.id === pond.selectedId);
  return { kind: 'Private review UI state; not an automated test verdict', renderer: mode, settings, status: controller?.getStatus(), actor: actor ? { padId: actor.padId, position: actor.model.position, motive: actor.motive.kind } : null, mounts, disposals, activeControllers: mounts - disposals, actionLog: [...actionLog] };
}
on($('snapshot'), 'click', () => { $('diagnostics').textContent = JSON.stringify(snapshot(), null, 2); });
on($('export-text'), 'click', () => { $('ascii').textContent = controller.exportText(); $('ascii').hidden = false; });
on($('export-log'), 'click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `frog-r2-${mode}-actions.json`;
  anchor.click(); URL.revokeObjectURL(url);
});
const media = window.matchMedia('(prefers-reduced-motion: reduce)');
on(media, 'change', syncStatus);
function dispose() {
  if (disposed) return;
  disposed = true; mountGeneration++; visibility?.dispose(); visibility = null;
  if (controller) { controller.dispose(); disposals++; }
  for (const remove of cleanups.splice(0)) remove();
}
on(window, 'pagehide', event => { if (!event.persisted) dispose(); });
window.__frogR2Review = Object.freeze({ get controller() { return controller; }, get renderer() { return mode; }, snapshot, dispose });
mount(mode);
