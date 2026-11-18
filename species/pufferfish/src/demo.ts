import { mountPufferfish } from './controller.js';
import type { PufferfishController, PufferfishStatus } from './controller.js';
import type { PufferfishLegacyDependency } from './legacy-painter.js';
import type { PufferfishQuality, PufferfishView } from './types.js';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing demo control: ${id}`);
  return value as T;
}
let controller: PufferfishController | null = null;
let interactions: AbortController | null = null;
const labels: Record<PufferfishStatus['phase'], string> = {
  idle: 'Calm waters', approach: 'A moment of curiosity', inflating: 'Finding a little courage',
  holding: 'A little more round', recovering: 'Breathing room', cooldown: 'Settling into the current',
};
function mountDemo(): void {
  if (controller) return;
  const canvas = element<HTMLCanvasElement>('pufferfish');
  const status = element('status'), fallback = element('fallback');
  const pause = element<HTMLButtonElement>('pause');
  const scope = new AbortController(); interactions = scope;
  const on = (id: string, type: string, callback: () => void): void => {
    element(id).addEventListener(type, callback, { signal: scope.signal });
  };
  const showError = (error: unknown): void => {
    fallback.hidden = false;
    status.textContent = `The animation is unavailable: ${error instanceof Error ? error.message : 'Canvas could not start'}`;
    for (const node of document.querySelectorAll<HTMLButtonElement | HTMLSelectElement | HTMLInputElement>('.controls button,.controls select,.controls input')) node.disabled = true;
  };
  try {
    const legacy = (window as unknown as { CuttlefishArtwork?: PufferfishLegacyDependency }).CuttlefishArtwork;
    if (!legacy) throw new Error('The artwork source did not load. Serve the repository root and try again.');
    controller = mountPufferfish(canvas, legacy, { onError: showError, onChange: next => {
      element('phase').textContent = labels[next.phase];
      element('motion-label').textContent = next.running ? 'IN THE CURRENT' : 'STILL WATERS';
      pause.textContent = next.userPaused ? 'Resume' : 'Pause';
      pause.setAttribute('aria-pressed', String(next.userPaused));
      element('motion-note').hidden = !(next.reducedMotion || next.userPaused || next.compact);
    } });
    fallback.hidden = true;
    on('approach', 'click', () => {
      const result = controller!.approach();
      status.textContent = result.kind === 'static-poster' ? 'Inflated pose. Still view remains active.'
        : result.kind === 'suspended' ? 'The fish is resting while its view is small or out of sight.'
        : 'You have approached. Give it a moment to notice you.';
    });
    on('retreat', 'click', () => {
      const result = controller!.retreat();
      status.textContent = result.kind === 'static-poster' ? 'Calm pose. Still view remains active.' : 'You gave it some space.';
    });
    on('pause', 'click', () => {
      controller!.setPaused(!controller!.getStatus().userPaused);
      status.textContent = controller!.getStatus().userPaused ? 'Animation paused.'
        : controller!.getStatus().reducedMotion ? 'Still view follows your reduced-motion preference.' : 'Animation resumed.';
    });
    on('reset', 'click', () => { controller!.reset(); status.textContent = 'Encounter reset. Your pause setting is preserved.'; });
    on('view', 'change', () => { controller!.configureRender({ view: element<HTMLSelectElement>('view').value as PufferfishView }); });
    on('quality', 'change', () => { controller!.configureRender({ quality: element<HTMLSelectElement>('quality').value as PufferfishQuality }); });
    on('monochrome', 'change', () => { controller!.configureRender({ monochrome: element<HTMLInputElement>('monochrome').checked }); });
    on('apply', 'click', () => {
      try {
        controller!.configure({ seed: Number(element<HTMLInputElement>('seed').value),
          inflationScale: Number(element<HTMLSelectElement>('inflation').value), wobble: element<HTMLInputElement>('wobble').checked ? 1 : 0 });
        status.textContent = 'Character settings applied. A fresh encounter is ready.';
      } catch (error) { status.textContent = error instanceof Error ? error.message : 'Settings are invalid.'; }
    });
    on('capture-text', 'click', () => { element('text-frame').textContent = controller!.exportText(); });
  } catch (error) { controller?.destroy(); controller = null; scope.abort(); showError(error); }
}
function disposeDemo(): void { controller?.destroy(); controller = null; interactions?.abort(); interactions = null; }
window.addEventListener('pagehide', disposeDemo);
window.addEventListener('pageshow', mountDemo);
mountDemo();
