import { mountDragonfly, type DragonflyBrowserController, type DragonflyBrowserStatus } from './browser.js';
import { createDragonfly } from './model.js';
import { gridToText, rasterizeDragonfly } from './preview.js';
import type { DragonflyView, MotionMode } from './types.js';
import type { DragonflyCue, DragonflyDirectorOptions, DragonflyRole, DragonflyRoute, DragonflyScene } from './director.js';

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Dragonfly demo requires #${id}`);
  return element as T;
}
function initializeDragonflyDemo(): void {
  const canvas = requireElement<HTMLCanvasElement>('dragonfly');
  const pause = requireElement<HTMLButtonElement>('pause');
  const dart = requireElement<HTMLButtonElement>('dart');
  const dartLabel = requireElement<HTMLSpanElement>('dart-label');
  const perch = requireElement<HTMLButtonElement>('perch');
  const resume = requireElement<HTMLButtonElement>('return');
  const reset = requireElement<HTMLButtonElement>('reset');
  const motion = requireElement<HTMLSelectElement>('motion');
  const view = requireElement<HTMLSelectElement>('view');
  const guide = requireElement<HTMLSelectElement>('guide');
  const population = requireElement<HTMLSelectElement>('population');
  const route = requireElement<HTMLSelectElement>('route');
  const neutral = requireElement<HTMLInputElement>('neutral');
  const labels = requireElement<HTMLInputElement>('labels');
  const phase = requireElement('phase');
  const motionLabel = requireElement('motion-label');
  const populationLabel = requireElement('population-label');
  const selectedLabel = requireElement('selected-label');
  const selectedState = requireElement('selected-state');
  const sceneTitle = requireElement('scene-title');
  const actionStatus = requireElement('action-status');
  const textFrame = requireElement('text-frame');
  const capture = requireElement<HTMLButtonElement>('capture');
  const capturePng = requireElement<HTMLButtonElement>('capture-png');
  const fallback = requireElement('canvas-fallback');
  const sceneCards = [...document.querySelectorAll<HTMLButtonElement>('[data-scene]')];
  const castCards = [...document.querySelectorAll<HTMLElement>('[data-member]')];
  const roleSelects = [...document.querySelectorAll<HTMLSelectElement>('[data-role]')];
  const sceneNames: Record<DragonflyScene, string> = { patrol: 'Pond patrol', attention: 'Hovering attention', relay: 'Reed relay' };
  const phaseNames: Record<string, string> = { patrol: 'Patrolling', attention: 'Watching', hover: 'Hovering', launch: 'Lifting off', dart: 'Darting', settle: 'Settling', return: 'Returning', land: 'Landing', perched: 'Perched', cooldown: 'Resting' };
  let host: DragonflyBrowserController | null = null;
  const teardown: Array<() => void> = [];
  function status(value: DragonflyBrowserStatus): void {
    pause.textContent = value.paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-pressed', String(value.paused));
    const still = value.reducedMotion || value.motion === 'static' || value.paused;
    dartLabel.textContent = still ? 'Change still pose' : 'Dart & return';
    perch.disabled = still; resume.disabled = still;
    perch.title = resume.title = still ? 'Flight cues are available in Natural or Slow motion. Change still pose remains available.' : '';
    motionLabel.textContent = value.reducedMotion ? 'REDUCED MOTION · STILL' : `${value.requestedMotion === 'full' ? 'NATURAL' : value.requestedMotion.toUpperCase()} MOTION`;
    const pond = value.director;
    if (!pond) return;
    phase.textContent = still ? (value.paused ? 'Paused' : 'Still pond') : ({ arrive: 'Arriving', patrol: 'Patrolling', intercept: 'An encounter', return: 'Returning', rest: 'At rest' }[pond.arc]);
    sceneTitle.textContent = sceneNames[pond.scene];
    population.value = String(pond.members.length);
    populationLabel.textContent = `${String(pond.members.length).padStart(2, '0')} ${pond.members.length === 1 ? 'VISITOR' : 'VISITORS'}`;
    for (const card of sceneCards) { const active = card.dataset.scene === pond.scene; card.classList.toggle('selected', active); card.setAttribute('aria-pressed', String(active)); }
    for (const card of castCards) {
      const id = Number(card.dataset.member), member = pond.members.find(item => item.id === id);
      card.hidden = !member; if (!member) continue;
      const active = member.id === pond.selected;
      card.classList.toggle('selected', active);
      card.querySelector('button')?.setAttribute('aria-pressed', String(active));
      const name = card.querySelector('strong');
      if (name) name.textContent = member.label;
      const memberPhase = card.querySelector('.member-phase');
      if (memberPhase) memberPhase.textContent = still ? 'Still pose' : phaseNames[member.phase.kind] ?? member.phase.kind;
      const role = card.querySelector('select');
      if (role) role.value = member.role;
    }
    const chosen = pond.members.find(member => member.id === pond.selected);
    selectedLabel.textContent = chosen ? `${chosen.label} / ${String(pond.selected + 1).padStart(2, '0')}` : 'a visitor';
    selectedState.textContent = chosen ? `${chosen.role[0]!.toUpperCase()}${chosen.role.slice(1)} · ${still ? 'A moment of stillness.' : phaseNames[chosen.phase.kind] ?? chosen.phase.kind}` : 'Choose a visitor.';
  }
  function listen(target: EventTarget, event: string, action: EventListener): void { target.addEventListener(event, action); teardown.push(() => target.removeEventListener(event, action)); }
  function announce(message: string): void { actionStatus.textContent = message; }
  function applyDirector(patch: Partial<DragonflyDirectorOptions>, message: string): void { host?.configureDirector(patch); announce(message); }
  function cue(action: DragonflyCue): void {
    if (!host) return;
    const before = host.getStatus(); host.cue(action);
    announce(before.paused || before.motion === 'static' || before.reducedMotion ? 'An alternate still pose. The pond remains paused.' : ({ dart: 'A short dart, a steady hover, then a return to the route.', perch: 'The selected visitor is settling onto a reed.', return: 'The selected visitor is returning to its route.' }[action]));
  }
  try {
    host = mountDragonfly(canvas, { director: { scene: 'patrol', count: 3 }, onStatus: status });
    const initial = host.getDirectorOptions()!;
    route.value = initial.route; labels.checked = initial.labels;
    for (const button of sceneCards) listen(button, 'click', () => applyDirector({ scene: button.dataset.scene as DragonflyScene }, `${sceneNames[button.dataset.scene as DragonflyScene]} selected. Each visitor keeps its identity.`));
    listen(population, 'change', () => applyDirector({ count: Number(population.value) }, `${population.value} visitors in the pond.`));
    listen(route, 'change', () => applyDirector({ route: route.value as DragonflyRoute }, 'The visitors are finding their new route.'));
    listen(labels, 'change', () => applyDirector({ labels: labels.checked }, labels.checked ? 'Visitor labels shown.' : 'Visitor labels hidden.'));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-select]')) listen(button, 'click', () => { host?.selectIndividual(Number(button.dataset.select)); announce(`Visitor ${String(Number(button.dataset.select) + 1).padStart(2, '0')} selected for your next cue.`); });
    for (const role of roleSelects) listen(role, 'change', () => {
      if (!host) return;
      const roles = [...host.getDirectorOptions()!.roles] as [DragonflyRole, DragonflyRole, DragonflyRole, DragonflyRole];
      roles[Number(role.dataset.role)] = role.value as DragonflyRole;
      applyDirector({ roles }, `Visitor ${String(Number(role.dataset.role) + 1).padStart(2, '0')} is now a ${role.value}.`);
    });
    for (const key of ['tempo', 'spread', 'breeze', 'scale'] as const) {
      const input = requireElement<HTMLInputElement>(key), output = requireElement<HTMLOutputElement>(`${key}-value`);
      input.value = String(initial[key]);
      const reflect = (): void => { output.textContent = Number(input.value).toFixed(key === 'tempo' ? 1 : 2) + (key === 'tempo' ? '×' : ''); };
      reflect(); listen(input, 'input', reflect); listen(input, 'change', () => applyDirector({ [key]: Number(input.value) }, `${key[0]!.toUpperCase()}${key.slice(1)} adjusted.`));
    }
    listen(pause, 'click', () => { if (!host) return; host.setPaused(!host.getStatus().paused); announce(host.getStatus().paused ? 'The pond is paused. Select a visitor or explore a still pose.' : host.getStatus().reducedMotion ? 'Your reduced-motion preference keeps the pond still.' : 'The pond is moving again.'); });
    listen(dart, 'click', () => cue('dart')); listen(perch, 'click', () => cue('perch')); listen(resume, 'click', () => cue('return'));
    listen(reset, 'click', () => { host?.reset(); guide.value = 'free'; announce('Returned to the original seed and arrangement. Scene choices and pause are preserved.'); });
    listen(motion, 'change', () => { host?.configure({ motion: motion.value as MotionMode }); announce(host?.getStatus().reducedMotion ? 'Your system requests reduced motion. The pond stays still.' : `${motion.selectedOptions[0]?.textContent ?? 'Motion'} selected.`); });
    listen(view, 'change', () => { host?.setView(view.value as DragonflyView); announce('View changed.'); });
    listen(neutral, 'change', () => { host?.setNeutral(neutral.checked); announce(neutral.checked ? 'Neutral silhouettes. Pond context and labels are hidden for this view.' : 'Pond tones restored.'); });
    listen(guide, 'change', () => {
      if (!host) return;
      const targets: Record<string, readonly [number, number]> = { left: [-.8, 0], right: [.8, 0], up: [0, -.8], down: [0, .8], center: [0, 0] };
      const target = targets[guide.value]; if (target) host.setTarget(target[0], target[1]); else host.clearTarget();
      announce(target ? `Guiding the selected visitor ${guide.selectedOptions[0]?.textContent?.toLowerCase() ?? 'toward the center'}.` : 'The selected visitor has returned to free flight.');
    });
    listen(capture, 'click', () => { if (host) textFrame.textContent = host.exportText(); announce('Captured the pond’s character cells.'); });
    listen(capturePng, 'click', () => {
      if (!host) return;
      try {
        const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = 'dragonfly-pond.png'; link.click();
        announce('Saved the actual pond canvas as a PNG.');
      } catch { announce('PNG capture is unavailable in this browser. Capture text remains available.'); }
    });
    textFrame.textContent = host.exportText();
    listen(window, 'pagehide', () => { for (const remove of teardown.splice(0)) remove(); host?.dispose(); host = null; });
    Object.defineProperty(window, 'dragonflyPreview', { value: host, configurable: true });
  } catch (error) {
    for (const remove of teardown.splice(0)) remove(); host?.dispose(); host = null;
    fallback.hidden = false; canvas.hidden = true;
    for (const control of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('button, select, input')) control.disabled = true;
    const poster = createDragonfly({ motion: 'static' }); textFrame.textContent = gridToText(rasterizeDragonfly(poster.sample(), { cols: 72, rows: 44, view: 'dorsal', neutral: true })); poster.dispose();
    announce(error instanceof Error ? error.message : 'The character canvas is unavailable.');
  }
}
if (typeof document !== 'undefined') initializeDragonflyDemo();
