import type { PufferfishConfig, PufferfishPhase, PufferfishState } from './types.js';
/** Opt-in, species-local choreography. The canonical marine renderer stays private. */
export type PufferfishScene = 'reef' | 'current' | 'shadow';
export type PufferfishRole = 'explorer' | 'sentinel' | 'drifter';
export interface PufferfishDirectorOptions {
    readonly scene?: PufferfishScene;
    readonly count?: number;
    readonly tempo?: number;
    readonly current?: number;
    readonly curiosity?: number;
    readonly spacing?: number;
    readonly size?: number;
    readonly labels?: boolean;
    readonly roles?: readonly PufferfishRole[];
}
export type PufferfishDirectorConfig = Readonly<Required<PufferfishDirectorOptions>>;
export type PufferfishSceneBeat = Readonly<{
    scene: 'reef';
    kind: 'discover' | 'inspect' | 'gather' | 'rest';
    progress: number;
}> | Readonly<{
    scene: 'current';
    kind: 'rising' | 'shelter' | 'returning' | 'slack';
    progress: number;
}> | Readonly<{
    scene: 'shadow';
    kind: 'watch' | 'shadow' | 'release' | 'resume';
    progress: number;
}>;
export type PufferfishMotive = 'exploring' | 'inspecting' | 'watching' | 'sheltering' | 'invited' | 'defensive' | 'settling';
export interface PufferfishAttention {
    readonly x: number;
    readonly y: number;
}
export interface PufferfishActor {
    readonly id: number;
    readonly name: string;
    readonly role: PufferfishRole;
    readonly motive: PufferfishMotive;
    readonly state: PufferfishState;
    /** Normalized canvas coordinates, x right, y down. */
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    /** Multiplicative object size, separate from inflation. */
    readonly scale: number;
    readonly yaw: number;
    readonly gaze: PufferfishAttention;
    readonly finEffort: number;
    readonly threat: number;
}
export interface PufferfishScenePointer {
    readonly x: number;
    readonly y: number;
    readonly aspect: number;
}
export type PufferfishDirectorInput = Readonly<{
    type: 'pointer';
    x: number;
    y: number;
    aspect: number;
}> | Readonly<{
    type: 'select';
    id: number;
}> | Readonly<{
    type: 'invite';
    x: number;
    y: number;
}> | Readonly<{
    type: 'approach';
}> | Readonly<{
    type: 'retreat';
}>;
export type PufferfishDirectorEvent = PufferfishDirectorInput & Readonly<{
    tick: number;
    seq: number;
}>;
export interface PufferfishDirectorState {
    readonly version: 'pufferfish-director-v1';
    readonly config: PufferfishDirectorConfig;
    readonly speciesConfig: PufferfishConfig;
    readonly tick: number;
    readonly lastSequence: number;
    readonly sceneTick: number;
    readonly cycle: number;
    readonly beat: PufferfishSceneBeat;
    readonly actors: readonly PufferfishActor[];
    readonly selected: number;
    readonly pointer: PufferfishScenePointer | null;
    readonly invitation: Readonly<{
        id: number;
        x: number;
        y: number;
        until: number;
    }> | null;
    readonly approach: Readonly<{
        id: number;
        until: number;
    }> | null;
    readonly quietUntil: number;
    readonly shadowCycle: number;
    /** Signed instantaneous current, bounded to [-1,1]. */
    readonly flow: number;
}
export interface PufferfishDirectorTick {
    readonly tick: number;
    readonly events?: readonly PufferfishDirectorEvent[];
}
export interface PufferfishDirectorResult {
    readonly state: PufferfishDirectorState;
    readonly beatChanged: boolean;
    readonly reacted: readonly number[];
}
export interface PufferfishSceneStatus {
    readonly scene: PufferfishScene;
    readonly beat: PufferfishSceneBeat['kind'];
    readonly selected: number;
    readonly count: number;
    readonly description: string;
    /** Presented poses, including deliberate still actions; simulation snapshots stay unchanged. */
    readonly actors: readonly Readonly<{
        id: number;
        name: string;
        role: PufferfishRole;
        motive: PufferfishMotive;
        phase: PufferfishPhase['kind'];
        threat: number;
    }>[];
}
