import type { OwlPresentation } from '../../types.js';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const p = clamp(n); return p * p * p * (p * (p * 6 - 15) + 10); };
export const OWL_REST_PRESENTATION: OwlPresentation = Object.freeze({
  headRollDeg: 0, airborne: 0, lift: 0, travel: 0, bankDeg: 0,
  crouch: 0, wingSweep: 0, tailFan: 0, feetReach: 0,
});
type FlightKey = Readonly<{ tick: number; wing: number; pose: OwlPresentation }>;
const key = (tick: number, wing: number, patch: Partial<OwlPresentation>): FlightKey =>
  Object.freeze({ tick, wing, pose: Object.freeze({ ...OWL_REST_PRESENTATION, ...patch }) });
// Fixed choreography, not a particle/physics approximation. Quintic segment ends
// hold velocity at zero: the long glide is distinct from departure and braking.
const flightKeys: readonly FlightKey[] = Object.freeze([
  key(0, 0, {}),
  key(26, .22, { crouch: .055, headRollDeg: -2 }),
  key(42, .48, { crouch: .07, wingSweep: .12 }),
  key(66, .88, { airborne: .78, lift: .29, travel: .022, wingSweep: -.22, tailFan: .2 }),
  key(90, .96, { airborne: 1, lift: .39, travel: .035, bankDeg: -3, tailFan: .16 }),
  key(152, .94, { airborne: 1, lift: .43, travel: .048, bankDeg: 2.5, tailFan: .14 }),
  key(198, .96, { airborne: 1, lift: .35, travel: .028, bankDeg: 1, tailFan: .35 }),
  key(228, 1, { airborne: .82, lift: .25, travel: .012, wingSweep: .68, tailFan: 1, feetReach: 1 }),
  key(248, .94, { airborne: .35, lift: .10, wingSweep: .65, tailFan: .8, feetReach: .65 }),
  key(264, .82, { wingSweep: .45, tailFan: .6 }),
  key(280, .62, { crouch: .055, wingSweep: .2, tailFan: .4 }),
  key(310, .18, { crouch: .009, tailFan: .08 }),
  key(340, 0, {}),
  key(360, 0, {}),
]);

export function owlFlightPose(age: number, direction: number, strength: number, elevation = -.25): Readonly<{ presentation: OwlPresentation; left: number; right: number; ruffle: number }> {
  const a = Math.max(0, Math.min(360, age));
  let i = 1;
  while (i < flightKeys.length - 1 && a > flightKeys[i]!.tick) i++;
  const from = flightKeys[i - 1]!, to = flightKeys[i]!;
  const u = ease((a - from.tick) / (to.tick - from.tick));
  const mix = (x: number, y: number) => x + (y - x) * u;
  const pose = { ...OWL_REST_PRESENTATION };
  for (const name of Object.keys(pose) as (keyof OwlPresentation)[]) pose[name] = mix(from.pose[name], to.pose[name]);
  const aimX = Math.max(-1, Math.min(1, direction));
  const aimY = Math.max(-1, Math.min(1, elevation));
  // The original returning flight only used the sign of x and moved 0.048 world
  // units. Keep its phase timing and landing, but make the chosen aim determine
  // the whole excursion. A central aim is a vertical hop; a far-side aim travels
  // ten times as far. Upward aim raises the arc, downward aim keeps it low.
  // Neither coordinate moves the perch or changes the committed landing point.
  pose.travel *= 10 * aimX;
  pose.lift *= (.46 - .10 * aimY) / .43;
  // Bank, anticipatory roll and paired-wing balance all pass continuously
  // through zero. A centred vertical hop must not pick an arbitrary side.
  pose.bankDeg *= aimX;
  pose.headRollDeg *= aimX;
  // Reaction strength controls feather expression, never whether feet can finish
  // their committed landing. At zero strength the flight still has safe anatomy.
  const wing = mix(from.wing, to.wing) * (.92 + .08 * strength);
  const asymmetry = .025 * Math.sin(Math.PI * clamp((a - 42) / 222)) * aimX;
  return Object.freeze({ presentation: Object.freeze(pose), left: clamp(wing - asymmetry), right: clamp(wing + asymmetry),
    ruffle: .18 * Math.sin(Math.PI * clamp((a - 264) / 76)) ** 2 * strength });
}

export function owlListeningPose(age: number, direction: number, strength: number): OwlPresentation {
  // A clear counter-cant first reads as "what was that?", then the whole facial
  // disc turns and holds. The body/feet remain planted. The response is staged,
  // with no decorative wobble during either held fixation.
  const anticipate = age > 0 && age < 24 ? -4 * Math.sin(Math.PI * age / 24) ** 2 : 0;
  const enter = ease((age - 18) / 30), recover = 1 - ease((age - 165) / 105);
  const secondFixation = ease((age - 104) / 26);
  const side = direction < 0 ? -1 : 1;
  return Object.freeze({ ...OWL_REST_PRESENTATION,
    headRollDeg: side * (anticipate + (9 - 3 * secondFixation) * enter * recover) * (.65 + .35 * strength) });
}
