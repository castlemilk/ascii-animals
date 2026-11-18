import { mountFox, type FoxBrowserOptions } from '../../src/browser.js';
import type { FoxDirectorInput, FoxDirectorOptions } from '../../src/director-types.js';

declare const canvas: HTMLCanvasElement;
const options: FoxBrowserOptions = {
  director: { scene: 'dusk-hunt', count: 3, roles: ['hunter', 'playmate', 'lookout'] },
  onDirectorInputs(batch: readonly FoxDirectorInput[]) {
    for (const input of batch) if (input.type === 'cue') input.cue satisfies 'rustle' | 'pounce' | 'play' | 'rest';
  },
};
const fox = mountFox(canvas, options);
const configured: FoxDirectorOptions = fox.configureDirector({ scene: 'moon-play', pace: 1.2 });
configured.scene satisfies 'dusk-hunt' | 'moon-play' | 'den-watch';
fox.cue('rustle', 1, { x: .4, y: .2 });
fox.selectFox(1);
fox.showTableau('listen');
fox.getDirectorState()?.actors[0]?.state.behavior.kind;
fox.getState().species satisfies 'fox';
fox.setPaused(true); fox.reset(); fox.dispose();

// @ts-expect-error The director does not accept a marine scene.
mountFox(canvas, { director: { scene: 'encounter' } });
// @ts-expect-error Population is bounded at three in the public type too.
mountFox(canvas, { director: { count: 4 } });
// @ts-expect-error A marine role is not a Fox motive.
mountFox(canvas, { director: { roles: ['orbit'] } });
// @ts-expect-error Fox cues have explicit names.
fox.cue('ink');
// @ts-expect-error Tableau choices are explicit; they are not arbitrary animations.
fox.showTableau('fly');
// @ts-expect-error A complete normalized point has both coordinates.
fox.cue('rustle', 0, { x: .5 });
// @ts-expect-error This source is borrowed, not a director-owned timer.
mountFox(canvas, { frameSource: { subscribe: () => 1 } });
// @ts-expect-error Configurations returned by the director are readonly.
configured.roles.push('hunter');
// @ts-expect-error Snapshots are not writable controls.
fox.getDirectorState()!.selectedId = 2;
