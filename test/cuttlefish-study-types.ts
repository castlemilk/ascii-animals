import { createCuttlefishStudy, type CuttlefishStudySnapshot } from '../lib/animals/cuttlefish-study.js';

declare const canvas: HTMLCanvasElement;
const art = createCuttlefishStudy(canvas, { habitat: true, automatic: false }, { seed: 20261119, autoStart: false });
art.cueStudy({ type: 'investigate', x: .2, y: -.1 });
art.cueStudy({ type: 'retreat' });
art.cueStudy({ type: 'release' });
art.setStudy({ restrainedSkin: true });
art.showStudyStill('turn', 2);
art.setOptions({ mode: 'points', maxCells: 8192 });
art.advance(1 / 60);
const snapshot: CuttlefishStudySnapshot = art.getStudy();
const primaryArms: 8 = snapshot.anatomy.primaryArms;
const feedingTentacles: 2 = snapshot.anatomy.feedingTentacles;
void primaryArms; void feedingTentacles;
// @ts-expect-error Unknown choreography is not accepted.
art.cueStudy({ type: 'teleport' });
// @ts-expect-error Pointer coordinates are both required.
art.cueStudy({ type: 'pointer', x: .1 });
// @ts-expect-error Immutable snapshots cannot mutate live state.
snapshot.tick = 5;
// @ts-expect-error A boolean option cannot be a string.
art.setStudy({ automatic: 'true' });
// @ts-expect-error Do not invent a public feeding strike action.
art.showStudyStill('strike');
art.destroy();
