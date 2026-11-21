import { mountOwl } from './browser.js';
import type { OwlActionResult, OwlBrowserController, OwlBrowserOptions } from './browser.js';
import type { OwlDirectorCue } from './director.js';

/** Private opt-in alternative; deliberately absent from the package export map. */
export interface LanternWardenArtwork extends OwlBrowserController {
  readonly species: 'owl';
  readonly variation: 'lantern-warden';
  readonly element: HTMLElement;
  readonly disposed: boolean;
  play(): void;
  pause(): void;
  restart(): void;
  pulse(): OwlActionResult;
}

/**
 * Construct one alternative renderer, never an Original renderer underneath it.
 * A selecting owner disposes its old renderer before calling this factory and
 * may pass a borrowed frameSource; disposal releases only this subscription.
 * Native touch buttons can call guide/cue on the same controller. Stage-focused
 * arrows aim, R/Enter listens, F flies, C calls, S stretches, Space pauses, and
 * Escape centres aim. Shifted letters retain the same command.
 */
export function createLanternWardenArtwork(
  host: HTMLElement,
  options: OwlBrowserOptions = {},
): LanternWardenArtwork {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Lantern Warden options must be an object.');
  }
  if (options.director !== undefined && (!options.director
    || typeof options.director !== 'object' || Array.isArray(options.director))) {
    throw new TypeError('Director options must be an object.');
  }
  let aim = { x: 0, y: 0 };
  let released = false;
  let ownsTabIndex = false;
  let ownsKeyboard = false;
  const controller = mountOwl(host, {
    ...options,
    director: { count: 1, autonomous: false, ...options.director },
  }, releaseOwnedResources);

  function guide(x: number, y: number, target?: 0 | 1): OwlActionResult {
    // Validate through the actual controller before committing the next aim.
    const result = controller.guide(x, y, target);
    aim = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    return result;
  }
  function cue(value: OwlDirectorCue): OwlActionResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError('A Lantern Warden cue must be an object.');
    }
    // Explicit fields win, including invalid undefined values: the director
    // rejects them atomically instead of this adapter silently repairing them.
    return controller.cue({ x: aim.x, y: aim.y, ...value });
  }
  function leave(): void {
    controller.leave();
    aim = { x: 0, y: 0 };
  }
  function reset(seed?: number): void {
    controller.reset(seed);
    aim = { x: 0, y: 0 };
  }
  function releaseOwnedResources(): void {
    if (released) return;
    released = true;
    if (ownsKeyboard) host.removeEventListener('keydown', keyboard);
    // Only undo the value installed here; a caller's later edit owns itself.
    if (ownsTabIndex && host.getAttribute('tabindex') === '0') host.removeAttribute('tabindex');
  }
  function dispose(): void {
    try { releaseOwnedResources(); }
    finally { controller.dispose(); }
  }
  function keyboard(event: KeyboardEvent): void {
    if (released || event.target !== host || event.repeat || event.isComposing
      || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = event.key === 'ArrowLeft' ? { x: -.85, y: aim.y }
      : event.key === 'ArrowRight' ? { x: .85, y: aim.y }
        : event.key === 'ArrowUp' ? { x: aim.x, y: -.75 }
          : event.key === 'ArrowDown' ? { x: aim.x, y: .75 } : null;
    if (direction) {
      event.preventDefault();
      guide(direction.x, direction.y);
      return;
    }
    const key = event.key.toLowerCase();
    if (!['r', 'enter', 'f', 'c', 's', ' ', 'escape'].includes(key)) return;
    event.preventDefault();
    if (key === 'r' || key === 'enter') cue({ kind: 'rustle' });
    else if (key === 'f') cue({ kind: 'flight' });
    else if (key === 'c') cue({ kind: 'call' });
    else if (key === 's') cue({ kind: 'stretch' });
    else if (key === ' ') controller.setPaused(!controller.getStatus().paused);
    else leave();
  }

  try {
    if (host.getAttribute('tabindex') === null) {
      host.setAttribute('tabindex', '0');
      ownsTabIndex = true;
    }
    host.addEventListener('keydown', keyboard);
    ownsKeyboard = true;
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze({
    ...controller,
    species: 'owl',
    variation: 'lantern-warden',
    element: host,
    get disposed() { return controller.getStatus().disposed; },
    guide, cue, leave, reset, dispose,
    play() { controller.setPaused(false); },
    pause() { controller.setPaused(true); },
    restart() { reset(); },
    pulse() { return controller.react(); },
  });
}
