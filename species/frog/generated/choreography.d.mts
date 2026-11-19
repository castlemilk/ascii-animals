import type { Vec3 } from './types.mjs';
/** Deliberately slowed for ASCII readability; these are authored timings. */
export declare function tongueMotion(age: number, duration: number, missed?: boolean): Readonly<{
    reach: number;
    contact: boolean;
    phase: 'prepare' | 'project' | 'contact' | 'return' | 'swallow';
}>;
/** One shared point is used by the insect and the tongue's contact endpoint. */
export declare function insectHover(contact: Vec3, scale: number, tick: number, side: number, motion: boolean): Vec3;
/** The visible prey and projected tongue share one bounded contact point. */
export declare function tongueTarget(mouth: Vec3, hover: Vec3, scale: number): Vec3;
/** Soft sag on return, with exact mouth/root and prey/tip attachment. */
export declare function tonguePoint(mouth: Vec3, insect: Vec3, reach: number, along: number, scale: number): Vec3;
