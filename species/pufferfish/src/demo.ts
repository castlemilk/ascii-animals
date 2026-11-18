import { mountPufferfish } from './controller.js';
import type { PufferfishActionResult, PufferfishController, PufferfishStatus } from './controller.js';
import type { PufferfishLegacyDependency } from './legacy-painter.js';
import type { PufferfishQuality, PufferfishView } from './types.js';
import type { PufferfishDirectorConfig, PufferfishDirectorOptions, PufferfishRole, PufferfishScene } from './director-types.js';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing demo control: ${id}`);
  return value as T;
}
const scenes: Record<PufferfishScene, { title: string; note: string }> = {
  reef: { title: 'Reef ramble', note: 'Separate discoveries, a shared meeting place. Invite one visitor into the open water.' },
  current: { title: 'Returning tide', note: 'The current rises. Watch the visitors paddle, shelter, then venture out into slack water.' },
  shadow: { title: 'Passing shadow', note: 'A watchful pause, a local defence, then confidence returning. Give the group room to settle.' },
};
const beats: Record<string, string> = {
  discover: 'Small discoveries', inspect: 'Taking a closer look', gather: 'A quiet gathering', rest: 'At ease among the reef',
  rising: 'The tide is rising', shelter: 'Finding a sheltered spot', returning: 'Into the returning tide', slack: 'A moment of slack water',
  watch: 'Keeping a gentle watch', shadow: 'Something passes overhead', release: 'The water feels safe again', resume: 'Curiosity returns',
};
const phases: Record<PufferfishStatus['phase'], string> = {
  idle: 'Calm', approach: 'Noticing you', inflating: 'Making a little room', holding: 'Round and watchful',
  recovering: 'Slowly settling', cooldown: 'Taking a breath',
};
const roleNotes: Record<PufferfishRole, string> = {
  explorer: 'An eager visitor, drawn to new places and quiet invitations.',
  sentinel: 'A watchful neighbour, pausing to inspect the water around it.',
  drifter: 'An unhurried traveller, content to move with the current.',
};
const defaultRoles: readonly PufferfishRole[] = ['explorer', 'sentinel', 'drifter'];
const initialDirector: PufferfishDirectorOptions = {
  scene: 'reef', count: 2, tempo: 1, current: .35, curiosity: .75, spacing: 1, size: 1, labels: true,
  roles: ['explorer', 'sentinel'],
};
const tuning = ['current', 'tempo', 'curiosity', 'size', 'spacing'] as const;
let controller: PufferfishController | null = null;
let interactions: AbortController | null = null;
let textUrl: string | null = null;

function mountDemo(): void {
  if (controller) return;
  const canvas = element<HTMLCanvasElement>('pufferfish');
  const status = element('status'), fallback = element('fallback');
  const pause = element<HTMLButtonElement>('pause');
  const scope = new AbortController(); interactions = scope;
  let lastConfig: PufferfishDirectorConfig | null = null;
  let lastBeat = '';
  let lastSelected = -1;
  let lastRole: PufferfishRole | null = null;
  const on = (id: string, type: string, callback: (event: Event) => void): void => {
    element(id).addEventListener(type, event => {
      try { callback(event); }
      catch (error) { status.textContent = error instanceof Error ? error.message : 'This setting could not be applied.'; }
    }, { signal: scope.signal });
  };
  const updateTuningLabels = (): void => {
    for (const key of tuning) {
      const value = Number(element<HTMLInputElement>(key).value);
      element<HTMLOutputElement>(`${key}-value`).value = key === 'current'
        ? `${value > 0 ? '+' : ''}${value.toFixed(2)}${value === 0 ? ' · still' : value < 0 ? ' · left' : ' · right'}`
        : key === 'curiosity' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}×`;
    }
  };
  const syncConfig = (config: PufferfishDirectorConfig): void => {
    if (config === lastConfig) return;
    lastConfig = config;
    for (const key of tuning) element<HTMLInputElement>(key).value = String(config[key]);
    element<HTMLSelectElement>('count').value = String(config.count);
    element<HTMLInputElement>('labels').checked = config.labels;
    element<HTMLButtonElement>('apply-director').disabled = true;
    element('tuning-note').textContent = 'Apply a new current or pace to begin the scene again. Your pause setting stays put.';
    updateTuningLabels();
  };
  const showStatus = (next: PufferfishStatus): void => {
    const snapshot = controller?.getDirectorSnapshot();
    const director = next.director;
    const selected = director?.actors[director.selected];
    const title = director ? scenes[director.scene].title : 'A little breathing room';
    const beat = director ? beats[director.beat] ?? director.beat : phases[next.phase];
    element('scene-title').textContent = title;
    element('phase').textContent = beat;
    element('scene-description').textContent = director ? scenes[director.scene].note : next.description;
    element('scene-beat').textContent = beat;
    element('motion-label').textContent = next.running ? 'IN THE CURRENT' : 'STILL WATERS';
    pause.textContent = next.userPaused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-pressed', String(next.userPaused));
    const still = next.reducedMotion || next.userPaused || next.compact;
    element('motion-note').hidden = !still;
    element('motion-note').textContent = next.reducedMotion
      ? 'Your reduced-motion preference is active. Select, Invite, Approach and Give space choose still compositions.'
      : next.compact ? 'This small view uses still compositions. All introductions and individual controls remain available.'
      : 'Paused. Select, Invite, Approach and Give space choose still compositions without resuming.';
    for (const scene of ['reef', 'current', 'shadow'] as const) {
      element(`scene-${scene}`).setAttribute('aria-pressed', String(director?.scene === scene));
    }
    if (snapshot) syncConfig(snapshot.config);
    if (director) {
      for (let id = 0; id < 3; id++) {
        const actor = director.actors[id];
        const button = element<HTMLButtonElement>(`actor-${id}`);
        button.hidden = !actor;
        if (!actor) continue;
        button.setAttribute('aria-pressed', String(id === director.selected));
        button.setAttribute('aria-label', `Select ${actor.name}, ${actor.role}, ${actor.motive}`);
        element(`actor-${id}-name`).textContent = actor.name;
        element(`actor-${id}-role`).textContent = actor.role;
        element(`actor-${id}-motive`).textContent = actor.motive;
      }
    }
    if (selected) {
      element('selected-name').textContent = selected.name;
      element('selected-phase').textContent = phases[selected.phase];
      element('actor-detail').textContent = `${roleNotes[selected.role]} Right now: ${selected.motive}.`;
      if (selected.id !== lastSelected || selected.role !== lastRole) element<HTMLSelectElement>('role').value = selected.role;
      lastRole = selected.role;
      const watch = Math.round(selected.threat * 100);
      element<HTMLMeterElement>('watchfulness').value = selected.threat;
      element('watchfulness-value').textContent = watch < 20 ? 'At ease' : watch < 55 ? 'Attentive' : 'On guard';
    }
    const beatKey = director ? `${director.scene}:${director.beat}` : '';
    if (beatKey && beatKey !== lastBeat && lastBeat) status.textContent = `${title}: ${beat}.`;
    else if (selected && selected.id !== lastSelected && lastSelected !== -1) status.textContent = `${selected.name} selected. ${roleNotes[selected.role]}`;
    lastBeat = beatKey;
    if (selected) lastSelected = selected.id;
  };
  const showError = (error: unknown): void => {
    fallback.hidden = false;
    status.textContent = `The animation is unavailable: ${error instanceof Error ? error.message : 'Canvas could not start'}`;
    for (const node of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('.controls button,.controls select,.controls input,.scene-choice,#capture-text')) node.disabled = true;
    element('download-text').removeAttribute('href');
    element('download-text').setAttribute('aria-disabled', 'true');
  };
  const actionMessage = (result: PufferfishActionResult, moving: string, still: string): void => {
    status.textContent = result.kind === 'suspended' ? 'The scene is resting while its canvas is out of sight or has no size.'
      : result.kind === 'static-poster' ? `${still} Still view remains active.` : moving;
  };
  const captureText = (): void => {
    const text = controller!.exportText();
    element('text-frame').textContent = text;
    if (textUrl) URL.revokeObjectURL(textUrl);
    textUrl = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }));
    element<HTMLAnchorElement>('download-text').href = textUrl;
    status.textContent = 'The current logical character frame is ready below.';
  };
  try {
    // A back/forward-cache remount starts the same explicit demo defaults.
    for (const node of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('.controls button,.controls select,.controls input,.scene-choice,#capture-text')) node.disabled = false;
    element('download-text').removeAttribute('aria-disabled');
    element<HTMLSelectElement>('view').value = 'right';
    element<HTMLSelectElement>('quality').value = 'fine';
    element<HTMLSelectElement>('mode').value = 'ascii';
    element<HTMLInputElement>('monochrome').checked = false;
    element<HTMLInputElement>('seed').value = '23';
    element<HTMLSelectElement>('inflation').value = '1.65';
    element<HTMLInputElement>('wobble').checked = true;
    const legacy = (window as unknown as { CuttlefishArtwork?: PufferfishLegacyDependency }).CuttlefishArtwork;
    if (!legacy) throw new Error('The artwork source did not load. Serve the repository root and try again.');
    controller = mountPufferfish(canvas, legacy, {
      species: { seed: 23 }, director: initialDirector, render: { quality: 'fine', mode: 'ascii' },
      onError: showError, onChange: showStatus,
    });
    fallback.hidden = true;
    showStatus(controller.getStatus());
    for (const scene of ['reef', 'current', 'shadow'] as const) on(`scene-${scene}`, 'click', () => {
      controller!.configureDirector({ scene });
      status.textContent = `${scenes[scene].title} begins. ${scenes[scene].note}`;
    });
    for (let id = 0; id < 3; id++) on(`actor-${id}`, 'click', () => { controller!.selectActor(id); });
    on('count', 'change', () => {
      const count = Number(element<HTMLSelectElement>('count').value);
      const roles = defaultRoles.slice(0, count);
      controller!.configureDirector({ count, roles });
      status.textContent = `${count === 1 ? 'One visitor' : `${count} visitors`} in a fresh scene. Individual roles begin with their defaults.`;
    });
    on('role', 'change', () => {
      const snapshot = controller!.getDirectorSnapshot();
      if (!snapshot) return;
      const roles = [...snapshot.config.roles];
      roles[snapshot.selected] = element<HTMLSelectElement>('role').value as PufferfishRole;
      controller!.configureDirector({ roles });
      controller!.selectActor(snapshot.selected);
      status.textContent = `Role changed to ${roles[snapshot.selected]}. A fresh scene begins; your pause setting is preserved.`;
    });
    on('invite', 'click', () => { actionMessage(controller!.invite(), 'A quiet invitation into the open water. Watch the selected visitor turn and investigate.', 'An invitation shown in a still composition.'); });
    on('approach', 'click', () => { actionMessage(controller!.approach(), 'You approached the selected visitor. Give it a moment to notice, then watch its belly and spines.', 'The selected visitor shows its inflated pose.'); });
    on('retreat', 'click', () => { actionMessage(controller!.retreat(), 'You gave the whole group space. Invitations clear and the visitors have time to settle.', 'The group returns to a calm composition.'); });
    on('pause', 'click', () => {
      controller!.setPaused(!controller!.getStatus().userPaused);
      const next = controller!.getStatus();
      status.textContent = next.userPaused ? 'Scene paused. Deliberate still actions remain available.'
        : next.reducedMotion ? 'Still view follows your reduced-motion preference.'
        : next.compact ? 'This small view remains still. Your playback preference is saved.' : 'The scene continues.';
    });
    on('reset', 'click', () => { controller!.reset(); status.textContent = 'Same visitors, same seed, a fresh scene. Your pause and scene settings are preserved.'; });
    for (const key of tuning) on(key, 'input', () => {
      updateTuningLabels();
      element<HTMLButtonElement>('apply-director').disabled = false;
      element('tuning-note').textContent = 'Your adjustments are ready. Apply them to begin a fresh scene.';
    });
    on('apply-director', 'click', () => {
      controller!.configureDirector({
        current: Number(element<HTMLInputElement>('current').value), tempo: Number(element<HTMLInputElement>('tempo').value),
        curiosity: Number(element<HTMLInputElement>('curiosity').value), size: Number(element<HTMLInputElement>('size').value),
        spacing: Number(element<HTMLInputElement>('spacing').value),
      });
      status.textContent = 'The new current and character settings are in place. A fresh scene begins.';
    });
    on('labels', 'change', () => { controller!.configureDirector({ labels: element<HTMLInputElement>('labels').checked }); status.textContent = 'Individual labels updated. The scene begins again.'; });
    on('view', 'change', () => { controller!.configureRender({ view: element<HTMLSelectElement>('view').value as PufferfishView }); });
    on('quality', 'change', () => { controller!.configureRender({ quality: element<HTMLSelectElement>('quality').value as PufferfishQuality }); });
    on('mode', 'change', () => { controller!.configureRender({ mode: element<HTMLSelectElement>('mode').value as 'ascii' | 'points' }); });
    on('monochrome', 'change', () => { controller!.configureRender({ monochrome: element<HTMLInputElement>('monochrome').checked }); });
    on('apply-character', 'click', () => {
      controller!.configure({ seed: Number(element<HTMLInputElement>('seed').value),
        inflationScale: Number(element<HTMLSelectElement>('inflation').value), wobble: element<HTMLInputElement>('wobble').checked ? 1 : 0 });
      status.textContent = 'Character settings applied. The scene starts again with your pause setting preserved.';
    });
    on('capture-text', 'click', captureText);
    on('download-text', 'click', captureText);
  } catch (error) { controller?.destroy(); controller = null; scope.abort(); showError(error); }
}
function disposeDemo(): void {
  controller?.destroy(); controller = null;
  interactions?.abort(); interactions = null;
  if (textUrl) URL.revokeObjectURL(textUrl);
  textUrl = null;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('pagehide', disposeDemo);
  window.addEventListener('pageshow', mountDemo);
  mountDemo();
}
