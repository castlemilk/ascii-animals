import { createDragonfly } from '../../lib/model.js';
import type { Dragonfly as OriginalDragonfly } from '../../lib/types.js';
import type { DragonflyBrowserController, DragonflyFrameSource } from '../../lib/browser.js';
import {
  KITE_SCOUT_VARIATION, createKiteScout, mountKiteScout,
  type KiteScoutMountOptions,
} from '../../src/variants/kite-scout/index.js';

declare const canvas: HTMLCanvasElement;
declare const frameSource: DragonflyFrameSource;
const options = {
  frameSource, paused:true, model:{seed:17,motion:'slow'}, director:{count:3,scene:'attention'},
} satisfies KiteScoutMountOptions;
const controller: DragonflyBrowserController = mountKiteScout(canvas,options);
const variant = createKiteScout({seed:17});
const structuralModel: OriginalDragonfly = variant;
const glyph: string | undefined = variant.sample().samples[0]!.glyph;
const id: 'kite-scout' = KITE_SCOUT_VARIATION.id;
controller.setTarget(.8,-.2);controller.dart();controller.dispose();
void [structuralModel,glyph,id];

// @ts-expect-error Integration must explicitly borrow its already-owned frame source.
mountKiteScout(canvas,{paused:true});
// @ts-expect-error A scheduler subscription must return its cleanup function.
mountKiteScout(canvas,{frameSource:{subscribe() {}}});
// @ts-expect-error The private entry adds no generic renderer/selector configuration.
mountKiteScout(canvas,{frameSource,variant:'kite-scout'});
// @ts-expect-error The public Original sample type is not expanded by a private import.
createDragonfly().sample().samples[0]!.glyph;
// @ts-expect-error The private model preserves the existing explicit motion vocabulary.
createKiteScout({motion:'automatic'});
