/**
 * The repository build mirrors the explicit public Owl package entry here.
 * In an installed review package, use: from 'ascii-animals-review/owl'.
 * This module does not access document/window or start a clock during import.
 */
import {
  createOwlArtwork, createOwlDirector, makeOwlDirectorPoster, renderOwlDirectorGrid,
  type OwlArtwork, type OwlBrowserOptions, type OwlDirectorInput,
  type OwlDirectorOptions, type OwlDirectorState,
} from '../../../lib/public/owl.js';

export const twilightDirector = {
  scene: 'lookout', count: 2, layout: 'bough',
  roles: ['sentinel', 'curious'], tempo: 1,
  alertness: .72, sociability: .65, breeze: .25, autonomous: true,
} as const satisfies OwlDirectorOptions;

/** Call after the host is mounted and sized; its owner must call dispose(). */
export function mountTwilight(
  host: HTMLElement,
  showScene: (scene: OwlDirectorState) => void,
): OwlArtwork {
  const options = {
    owl: { seed: 7, headYawLimitDeg: 28, reactionStrength: .85 },
    director: twilightDirector,
    // Status supplies the displayed scene, even during construction or a still.
    onStatus(status) { if (status.director) showScene(status.director); },
  } satisfies OwlBrowserOptions;
  return createOwlArtwork(host, options); // borrows the shared browser scheduler
}

/** A deliberate still, not a shortcut around reduced-motion preferences. */
export function showQuietRoost(artwork: OwlArtwork): void {
  artwork.pause();
  artwork.updateDirector({ scene: 'roost', count: 2, layout: 'close', roles: ['dreamer', 'sentinel'] });
  artwork.reset(7); // retains this configuration and the explicit pause
  artwork.leave(); // selects the resting scene poster without advancing tick 0
}

/** Export resolved creation settings, not a recording or persisted live state. */
export function exportConfiguration(artwork: OwlArtwork): string {
  const snapshot = artwork.getSnapshot();
  const scene = artwork.getDirectorSnapshot(); // simulation; excludes display-only poster
  if (!scene) throw new TypeError('This example requires an enabled Owl director');
  return JSON.stringify({
    schemaVersion: 1, species: 'owl',
    owl: snapshot.simulation.config,
    director: scene.config,
    note: 'Creation settings only; motion replay also needs ordered inputs and integer ticks.',
  }, null, 2);
}

export type TwilightReplay = Readonly<{
  state: OwlDirectorState;
  text: string;
  stillText: string;
  acceptedCues: number;
  ignoredCues: number;
}>;

/** Deterministic, DOM-free model example; the caller owns every integer tick. */
export function replayTwilight(): TwilightReplay {
  const director = createOwlDirector(twilightDirector, { seed: 7, reactionStrength: .85 });
  const events = [
    { tick: 30, seq: 0, type: 'attention', target: 1, x: -.6, y: -.2 },
    { tick: 60, seq: 1, type: 'cue', cue: { kind: 'call', target: 0, x: .6, y: -.3 } },
    { tick: 180, seq: 2, type: 'cue', cue: { kind: 'rustle', target: 1 } }, // ignored during call
    { tick: 240, seq: 3, type: 'leave' },
    { tick: 480, seq: 4, type: 'cue', cue: { kind: 'stretch', target: 1 } },
  ] as const satisfies readonly OwlDirectorInput[];
  let acceptedCues = 0, ignoredCues = 0;
  try {
    for (let tick = 1; tick <= 720; tick++) {
      const result = director.advance(tick, events.filter(event => event.tick === tick));
      acceptedCues += result.acceptedCues;
      ignoredCues += result.ignoredCues;
    }
    const state = director.getState();
    const still = makeOwlDirectorPoster(state, { kind: 'attention', target: 1, x: .7, y: -.2 });
    // state is unchanged; still has separate actor poses and poster: true.
    return {
      state,
      text: renderOwlDirectorGrid(state, { cols: 144, rows: 60 }).text,
      stillText: renderOwlDirectorGrid(still, { cols: 144, rows: 60 }).text,
      acceptedCues, ignoredCues,
    };
  } finally {
    director.dispose();
  }
}
