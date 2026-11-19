import {
  createOwlDirector, makeOwlDirectorPoster, renderOwlDirectorGrid, mountOwl,
  type OwlDirectorCue, type OwlDirectorInput, type OwlPresentation,
} from '../build/index.js';

const flight = { kind: 'flight', target: 0, x: -.7, y: -.3 } satisfies OwlDirectorCue;
const director = createOwlDirector({ count: 1, autonomous: false }, { seed: 7 });
const event = { tick: 1, seq: 0, type: 'cue', cue: flight } satisfies OwlDirectorInput;
director.advance(1, [event]);
for (let tick = 2; tick <= 229; tick++) director.advance(tick);
const state = director.getState();
const presentation: OwlPresentation | undefined = state.actors[0]?.pose.presentation;
renderOwlDirectorGrid(state, { cols: 64, rows: 36 });
makeOwlDirectorPoster(state, flight); // grounded open-wing still; no simulation step
void presentation;
director.dispose();

export function mountFlightExample(host: HTMLElement) {
  const artwork = mountOwl(host, { director: { count: 1 } });
  artwork.cue(flight);
  artwork.cue({ kind: 'rustle', target: 0, x: .6, y: -.2 }); // ignored while flight/cooldown is active
  return artwork; // caller must dispose on unmount
}

// @ts-expect-error Third actors remain unsupported.
const invalidTarget: OwlDirectorCue = { kind: 'flight', target: 2 };
// @ts-expect-error Presentation is immutable, not a writable simulation control.
if (presentation) presentation.lift = 1;
void invalidTarget;
