import { createOwl, makeOwlPoster, renderOwlGrid, resolveOwlOptions, type OwlBehavior, type OwlConfig, type OwlInput, type OwlOptions, type OwlState } from '../build/index.js';

const options = { seed: 12, reactionStrength: .75, headYawLimitDeg: 30 } satisfies OwlOptions;
const owl = createOwl(options);
const events: readonly OwlInput[] = [
  { tick: 1, seq: 0, type: 'attention', x: .8, y: .3 },
  { tick: 1, seq: 1, type: 'react' },
];
const state: OwlState = owl.advance(1, events).state;
const config: OwlConfig = owl.update({ cooldownTicks: 60 });
renderOwlGrid(makeOwlPoster(state, { kind: 'attention', x: 0, y: 0 }));
function exhaustive(behavior: OwlBehavior): string {
  switch (behavior.kind) {
    case 'idle': case 'approach': return behavior.kind;
    case 'response': return behavior.phase;
    case 'recovery': return String(behavior.phaseTick);
    case 'cooldown': return String(behavior.untilTick);
    default: { const never: never = behavior; return never; }
  }
}
exhaustive(state.behavior); void config;

// @ts-expect-error Seed must be numeric.
createOwl({ seed: '42' });
// @ts-expect-error No invented species registry option.
createOwl({ species: 'owl' });
// @ts-expect-error No public count/formation compatibility claim.
owl.update({ count: 2 });
// @ts-expect-error Reset alone changes seed.
owl.update({ seed: 9 });
// @ts-expect-error Unknown interaction type.
owl.advance(2, [{ tick: 2, seq: 2, type: 'startle' }]);
// @ts-expect-error Attention needs both coordinates.
owl.advance(2, [{ tick: 2, seq: 2, type: 'attention', x: 0 }]);
// @ts-expect-error Explicit integer time remains a number.
owl.advance('2');
// @ts-expect-error Published state is immutable.
state.headYawDeg = 720;
// @ts-expect-error Nested options are immutable.
state.config.headYawLimitDeg = 720;
// @ts-expect-error Phase only exists after narrowing the discriminated union.
state.behavior.phase;
// @ts-expect-error Poster has a closed vocabulary.
makeOwlPoster(state, { kind: 'spin' });
// @ts-expect-error Exact optional properties reject undefined configuration.
createOwl({ seed: undefined });
// @ts-expect-error The trusted merge base is not a public parameter.
resolveOwlOptions({}, config);

import {createOwlDirector,makeOwlDirectorPoster,renderOwlDirectorGrid,mountOwl,type OwlDirectorOptions,type OwlDirectorInput} from '../build/index.js';
const direction = {scene:'duet',count:2,roles:['sentinel','dreamer'],tempo:.8} satisfies OwlDirectorOptions;
const director = createOwlDirector(direction, {seed:7});
const directedInputs:readonly OwlDirectorInput[] = [{tick:1,seq:0,type:'cue',cue:{kind:'call',target:1,x:.3,y:-.5}}];
const directedState=director.advance(1,directedInputs).state;
renderOwlDirectorGrid(makeOwlDirectorPoster(directedState,{kind:'stretch',target:0}),{cols:144,rows:60});
director.update({scene:'roost',count:1});
const mount = (element:HTMLElement) => {
 const artwork=mountOwl(element,{director:direction});
 artwork.cue({kind:'rustle',target:1});artwork.guide(.8,-.3,1);artwork.updateDirector({layout:'split'});
 return artwork.getStatus().director;
};void mount;
// @ts-expect-error Bounded ensemble has no third member.
createOwlDirector({count:3});
// @ts-expect-error Roles are a copied two-entry tuple, not an arbitrary population array.
createOwlDirector({roles:['sentinel']});
// @ts-expect-error Marine behavior is not an Owl role.
director.update({roles:['cruise','dreamer']});
// @ts-expect-error Scene vocabulary is closed.
director.update({scene:'school'});
// @ts-expect-error State/config are immutable snapshots.
directedState.config.roles[0]='curious';
// @ts-expect-error Director input requires the cue object.
director.advance(2,[{tick:2,seq:1,type:'cue',kind:'call'}]);
// @ts-expect-error Exact optional configuration rejects undefined.
director.update({tempo:undefined});
// @ts-expect-error No unchecked base can be injected into the options resolver.
createOwlDirector({count:2}, {seed:'7'});
