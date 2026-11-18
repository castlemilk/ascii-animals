/** Additive marine-only choreography, available through the existing /cuttlefish entry. */
export type MarineScene = 'reef-rendezvous' | 'upwelling-ballet' | 'tidepool-investigation';
export type MarineChapter = 'arrive' | 'engage' | 'explore' | 'depart';
export type MarineRole = 'auto' | 'guide' | 'forager' | 'sentinel' | 'companion';

/** Strictly validated. Undefined means omitted; unknown keys are rejected. */
export interface MarineDirectorOptions {
  scene?: MarineScene;
  /** Cycle seconds at the default travel amount; 20..80, default40. */
  duration?: number;
  /** Signed current -1..1; changes direction/energy, not particle allocation. */
  current?: number;
  /** Composition spacing .65..1.5. */
  spread?: number;
  /** Invitation strength 0..1.5. */
  intimacy?: number;
  /** Autonomous secondary motion/attention 0..1.5. */
  autonomy?: number;
  /** One-based existing cast member; normalize permits1..12, mounting checks cast size. */
  focus?: number;
  roles?: readonly MarineRole[];
  backdrop?: boolean;
}
export type MarineDirectorConfig = Readonly<Required<MarineDirectorOptions>>;
export interface MarineSceneDefinition {
  readonly id: MarineScene;
  readonly title: string;
  readonly description: string;
  readonly chapters: readonly string[];
}
export type MarineCue =
  | { readonly type: 'invite'; readonly x: number; readonly y: number }
  | { readonly type: 'release' }
  | { readonly type: 'disturb'; readonly id?: number };
export interface MarineMemberStats {
  readonly id: number;
  readonly species: 'cuttlefish' | 'manta' | 'octopus';
  readonly role: Exclude<MarineRole, 'auto'>;
  readonly motive: string;
  readonly focused: boolean;
  readonly visible: boolean;
  readonly phase: string;
}
export interface MarineDirectorStats {
  readonly enabled: boolean;
  readonly config: MarineDirectorConfig | null;
  readonly scene: MarineScene | null;
  readonly title: string;
  readonly chapter: MarineChapter | null;
  readonly chapterLabel: string;
  readonly progress: number;
  readonly time: number;
  readonly cycle: number;
  readonly focused: number;
  readonly cue: Readonly<{ x: number; y: number; active: boolean; interest: number }>;
  readonly members: readonly MarineMemberStats[];
}
