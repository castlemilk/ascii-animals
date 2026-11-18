import type { FrogAction, FrogConfig, FrogConfigPatch, FrogInput, FrogOptions, FrogPose, FrogState, FrogStepResult, GeometryOptions, Vec2 } from './types.mjs';
export declare const FROG_LIMITS: Readonly<{
    maxSamples: 32000;
    eventsPerTick: 8;
    tickRate: 60;
    maxTick: 2147483647;
    cols: 180;
    rows: 100;
}>;
export declare const FROG_DEFAULTS: Readonly<FrogConfig>;
export declare const clamp: (v: number, lo: number, hi: number) => number;
export declare function finite(value: unknown, label: string): number;
export declare function integer(value: unknown, min: number, max: number, label: string): number;
export declare function ownKeys(value: unknown, allowed: readonly string[], label: string): void;
export declare function validateTarget(value: Vec2): Vec2;
/** Unknown fields and non-finite/out-of-range values fail before any mutation. */
export declare function configureFrog(patch?: FrogConfigPatch, base?: Readonly<FrogConfig>): Readonly<FrogConfig>;
export declare function createFrog(options?: FrogOptions): FrogState;
/** Returns the reachable landing point; the preview and flight use this same rule. */
export declare function landingTarget(state: FrogState, target?: Vec2): Vec2;
/** One explicit 60Hz step. Entire event batch validates before state is created. */
export declare function stepFrog(state: FrogState, tick: number, inputs?: readonly FrogInput[]): FrogStepResult;
/** Clear host-transient preview without moving animal time or an active leap. */
export declare function clearFrogTarget(state: FrogState): FrogState;
/** An intentional static target change, with no autonomous tick or leap. */
export declare function previewFrogTarget(state: FrogState, target: Vec2): FrogState;
export declare function resetFrog(state: FrogState, options?: Readonly<{
    seed?: number;
    config?: FrogConfigPatch;
}>): FrogState;
/** Root travel is separate from local articulation. y points down, z toward camera. */
export declare function poseFrog(state: FrogState, options?: GeometryOptions): FrogPose;
/** CSS-rect input, independent of DPR. Invalid/zero rect is a safe no-target result. */
export declare function normalizeFrogPointer(clientX: number, clientY: number, rect: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
}>): Vec2 | null;
export declare function stampFrogAction(action: FrogAction, tick: number, seq: number): FrogInput;
