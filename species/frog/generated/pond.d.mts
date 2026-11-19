import type { FrogPose, GeometryOptions, Vec2, Vec3 } from './types.mjs';
import type { FrogDirectorConfig, FrogDirectorOptions, FrogPondActor, FrogPondInput, FrogPondOptions, FrogPondState, FrogPondStepResult, FrogRole } from './pond-types.mjs';
export declare const FROG_POND_LIMITS: Readonly<{
    tickRate: 60;
    maxTick: 2147483647;
    eventsPerTick: 8;
    maxActors: 3;
    maxPads: 6;
    maxAirborne: 1;
    maxRipples: 6;
    maxReplies: 2;
    maxFireflies: 1;
    maxSceneSamples: 60000;
    callTicks: 84;
    trackTicks: 36;
    strikeTicks: 30;
    settleTicks: 48;
    listenTicks: 72;
    rippleTicks: 90;
    fireflyTicks: 240;
    replyDelayTicks: 36;
    replySpacingTicks: 30;
}>;
export declare const FROG_DIRECTOR_DEFAULTS: Readonly<FrogDirectorConfig>;
/** Atomic schema validation, including owned copies of all three role entries. */
export declare function configureFrogDirector(patch?: FrogDirectorOptions, base?: Readonly<FrogDirectorConfig>): Readonly<FrogDirectorConfig>;
/** Initial placement is authored once; subsequent travel uses the body model. */
export declare function createFrogPond(options?: FrogPondOptions): FrogPondState;
/** Selection never changes an actor's clock, body, position or active plan. */
export declare function selectPondFrog(state: FrogPondState, id: number): FrogPondState;
/** Role edits apply to later cues and survive reset; active motives are retained. */
export declare function setPondRole(state: FrogPondState, id: number, nextRole: FrogRole): FrogPondState;
/** A transient target preview is a deliberate zero-time edit, never a hop. */
export declare function previewPondTarget(state: FrogPondState, target: Vec2 | null): FrogPondState;
/** Merge validated configuration, then reconstruct the exact seeded ensemble. */
export declare function resetFrogPond(state: FrogPondState, options?: FrogPondOptions): FrogPondState;
/**
 * Validate the whole batch, then advance every model exactly one logical tick.
 * Leap commands replay that one body step with two local inputs; they never
 * advance a model twice. Scene inputs and transient gaze edits have their own log.
 */
export declare function stepFrogPond(state: FrogPondState, tick: number, inputs?: readonly FrogPondInput[]): FrogPondStepResult;
/** Normalized pad-plane coordinates; z provides deterministic front/back depth. */
export declare function pondPointToWorld(value: Vec2): Vec3;
/** The same anatomical pose, placed in the pond and given a bounded local motive. */
export declare function posePondFrog(state: FrogPondState, actor: FrogPondActor, options?: GeometryOptions): FrogPose;
