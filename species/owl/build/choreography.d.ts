import type { OwlPresentation } from './types.js';
export declare const OWL_REST_PRESENTATION: OwlPresentation;
export declare function owlFlightPose(age: number, direction: number, strength: number): Readonly<{
    presentation: OwlPresentation;
    left: number;
    right: number;
    ruffle: number;
}>;
export declare function owlListeningPose(age: number, direction: number, strength: number): OwlPresentation;
