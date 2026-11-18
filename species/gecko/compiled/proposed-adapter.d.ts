import type { GeckoInput, GeckoMaterial, GeckoModel, GeckoOptionsPatch } from './types.js';
export interface ProposedGeometryWriter {
    readonly capacity: number;
    readonly count: number;
    write(x: number, y: number, z: number, light: number, material: number, stableSeed: number): boolean;
}
export interface ProposedGeckoState {
    readonly model: GeckoModel;
}
export interface ProposedGeckoDefinition {
    readonly maxSamples: number;
    create(options: GeckoOptionsPatch, seed: number): ProposedGeckoState;
    update(state: ProposedGeckoState, input: GeckoInput, dtSeconds: number): void;
    sample(state: ProposedGeckoState, writer: ProposedGeometryWriter): void;
    describe(state: ProposedGeckoState): string;
}
/** Host supplies material IDs; the current cuttlefish atlas is not assumed. */
export declare function createProposedGeckoDefinition(materialIds: Readonly<Record<GeckoMaterial, number>>): ProposedGeckoDefinition;
