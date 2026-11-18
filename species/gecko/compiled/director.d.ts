import type { GeckoOptions, GeckoOptionsPatch, GeckoState, Vec2 } from './types.js';
export type GeckoScene = 'moonlit-wall' | 'lantern-hunt' | 'passing-shadow';
export type GeckoRole = 'scout' | 'hunter' | 'sentry';
export type GeckoIndividualId = 'mica' | 'pip' | 'slate';
export type GeckoMotive = 'explore' | 'inspect' | 'stalk' | 'poise' | 'strike' | 'shelter' | 'return' | 'watch' | 'yield' | 'retreat';
export type GeckoEmotion = 'curious' | 'focused' | 'wary' | 'content';
export interface GeckoDirectorOptions {
    readonly scene: GeckoScene;
    /** Integer1..3. Surviving IDs and contacts are preserved. Default3. */
    readonly population: number;
    /** .4..1.6. Score tempo and animal pace multiplier. Default1. */
    readonly tempo: number;
    /** 0..1. Interest duration and shadow sensitivity. Default.55. */
    readonly boldness: number;
    readonly reverse: boolean;
    readonly showRoutes: boolean;
    readonly autonomy: boolean;
    /** One to three role assignments, missing slots use the original defaults. */
    readonly roles: readonly GeckoRole[];
}
export type GeckoDirectorOptionsPatch = Partial<GeckoDirectorOptions>;
export interface GeckoDirectorConfig {
    readonly seed?: number;
    readonly heading?: number;
    readonly options?: GeckoDirectorOptionsPatch;
    readonly animal?: GeckoOptionsPatch;
}
/** Director owns member habitats; reset only seed and optional common heading. */
export interface GeckoDirectorReset {
    readonly seed?: number;
    readonly heading?: number;
}
interface ArcTiming {
    readonly beatIndex: number;
    readonly progress: number;
    readonly cycle: number;
    readonly scoreTick: number;
}
export type GeckoSceneArc = ArcTiming & ({
    readonly scene: 'moonlit-wall';
    readonly beat: 'emerge' | 'climb' | 'inspect' | 'traverse' | 'perch';
} | {
    readonly scene: 'lantern-hunt';
    readonly beat: 'notice' | 'stalk' | 'poise' | 'strike' | 'return';
} | {
    readonly scene: 'passing-shadow';
    readonly beat: 'peek' | 'explore' | 'shadow' | 'shelter' | 'return' | 'settle';
});
export interface GeckoIndividualState {
    readonly id: GeckoIndividualId;
    readonly label: string;
    readonly role: GeckoRole;
    /** Constant placement scale: stance contacts are never translated by a scene transform. */
    readonly scale: number;
    readonly body: GeckoState;
    readonly motive: GeckoMotive;
    readonly emotion: GeckoEmotion;
    readonly tailExpression: number;
    readonly blink: boolean;
    readonly route: readonly Vec2[];
    readonly routeIndex: number;
    readonly goal: Vec2 | null;
    readonly cooldown: number;
    readonly catches: number;
}
export interface GeckoDirectorState {
    readonly version: 1;
    readonly seed: number;
    readonly tick: number;
    readonly lastSequence: number;
    readonly options: Readonly<GeckoDirectorOptions>;
    readonly arc: GeckoSceneArc;
    readonly selectedId: GeckoIndividualId | null;
    readonly pointer: Vec2 | null;
    readonly moth: {
        readonly position: Vec2;
        readonly visible: boolean;
        readonly caughtBy: GeckoIndividualId | null;
    };
    readonly shadow: {
        readonly active: boolean;
        readonly progress: number;
        readonly position: Vec2;
    };
    readonly individuals: readonly GeckoIndividualState[];
    readonly lastAction: GeckoDirectorReceipt | null;
}
export type GeckoCuePosition = {
    readonly x: number;
    readonly y: number;
} | {
    readonly x?: never;
    readonly y?: never;
};
export type GeckoDirectorCue = {
    readonly id?: GeckoIndividualId;
} & GeckoCuePosition & {
    readonly type: 'moth' | 'shadow' | 'return' | 'inspect';
};
export type GeckoDirectorEvent = {
    readonly tick: number;
    readonly seq: number;
} & ({
    readonly type: 'guide';
    readonly x: number;
    readonly y: number;
    readonly id?: GeckoIndividualId;
} | {
    readonly type: 'leave';
} | {
    readonly type: 'select';
    readonly id: GeckoIndividualId | null;
} | GeckoDirectorCue);
export type GeckoDirectorReceipt = {
    readonly seq: number;
    readonly type: GeckoDirectorEvent['type'];
    readonly outcome: 'applied';
    readonly id: GeckoIndividualId | null;
} | {
    readonly seq: number;
    readonly type: 'shadow';
    readonly outcome: 'ignored';
    readonly reason: 'busy';
    readonly id: GeckoIndividualId;
};
export interface GeckoDirectorStepResult {
    readonly state: GeckoDirectorState;
    readonly inputs: readonly GeckoDirectorReceipt[];
}
export interface GeckoDirectorRecipe {
    readonly version: 1;
    readonly kind: 'gecko-scene-recipe';
    readonly seed: number;
    readonly heading?: number;
    readonly options: Readonly<GeckoDirectorOptions>;
    readonly animal: Readonly<GeckoOptions>;
    /** Restarts these settings; this is not a serialized current-state checkpoint. */
    readonly startsAtTick: 0;
}
export interface GeckoDirector {
    readonly disposed: boolean;
    step(events?: readonly GeckoDirectorEvent[]): GeckoDirectorStepResult;
    getSnapshot(): GeckoDirectorState;
    update(patch: GeckoDirectorOptionsPatch): Readonly<GeckoDirectorOptions>;
    updateAnimal(patch: GeckoOptionsPatch): Readonly<GeckoOptions>;
    /** Configuration operation; changes selection without advancing simulation. */
    select(id: GeckoIndividualId | null): void;
    reset(options?: GeckoDirectorReset): GeckoDirectorState;
    exportRecipe(): GeckoDirectorRecipe;
    dispose(): void;
}
export declare const GECKO_DIRECTOR_LIMITS: Readonly<{
    animals: 3;
    samples: 36864;
    maxCols: 256;
    maxRows: 168;
    eventsPerTick: 32;
    environmentMarks: 4096;
    worldWidth: 6.6;
    worldHeight: 4.4;
    rootX: 2;
    rootY: 1;
}>;
export declare const DEFAULT_GECKO_DIRECTOR_OPTIONS: Readonly<GeckoDirectorOptions>;
export declare const GECKO_SCENES: readonly (Readonly<{
    id: "moonlit-wall";
    label: "Moonlit wall";
    description: "Three quiet lives follow the seams.";
    ticks: 1440;
}> | Readonly<{
    id: "lantern-hunt";
    label: "Lantern hunt";
    description: "A small light, a long moment of anticipation.";
    ticks: 1320;
}> | Readonly<{
    id: "passing-shadow";
    label: "Passing shadow";
    description: "Notice, shelter, then find courage again.";
    ticks: 1440;
}>)[];
export declare function resolveGeckoDirectorOptions(patch?: GeckoDirectorOptionsPatch, base?: Readonly<GeckoDirectorOptions>): Readonly<GeckoDirectorOptions>;
export declare function geckoSceneArc(scene: GeckoScene, scoreTick: number): GeckoSceneArc;
/** Opt-in director; each member uses the existing real contact-gait model. */
export declare function createGeckoDirector(config?: GeckoDirectorConfig): GeckoDirector;
/** Presentation-only deliberate pose. Does not step or mutate a director/model. */
export declare function geckoDirectorPoster(state: GeckoDirectorState, cue: GeckoDirectorCue): GeckoDirectorState;
export {};
