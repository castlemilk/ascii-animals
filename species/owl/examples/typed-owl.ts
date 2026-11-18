/** Local source entry; central package exports remain pending. */
import { createOwl, renderOwlGrid, type OwlBehavior, type OwlInput } from '../build/index.js';

const owl = createOwl({ seed: 42, headYawLimitDeg: 28, reactionStrength: .8 });
const inputs: readonly OwlInput[] = [{ tick: 1, seq: 0, type: 'attention', x: .7, y: -.2 }];
const result = owl.advance(1, inputs);
const behavior: OwlBehavior = result.state.behavior;
if (behavior.kind === 'response') console.log(behavior.phase);
owl.update({ featherContrast: .65 });
console.log(renderOwlGrid(owl.getState(), { cols: 96, rows: 54 }).text);
owl.reset(42);
owl.dispose();
