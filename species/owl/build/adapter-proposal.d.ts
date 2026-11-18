import type { OwlMaterial, OwlSample } from './types.js';
/** Matches the *design sketch* in PR2 docs/EXTENDING.md; not an accepted API. */
export interface ProposedOwlGeometryWriter {
    readonly capacity: number;
    readonly count: number;
    write(x: number, y: number, z: number, light: number, material: number, stableSeed: number): boolean;
}
export type OwlWriterMapping = Readonly<{
    /** Host must decide its actual material IDs. No cuttlefish table is assumed. */
    materials: Readonly<Record<OwlMaterial, number>>;
    unitsPerLocalUnit: number;
    yAxis: 'up' | 'down';
}>;
/**
 * Demonstrates an explicit mapping only. Requires a trusted synchronous writer.
 * Capacity/values are checked before the first write. If the host unexpectedly
 * refuses a write/throws, discard that destination frame; rollback is not implied.
 * Include/exclude the perch by filtering the caller's sample list explicitly.
 */
export declare function writeOwlSamplesToProposal(samples: readonly OwlSample[], writer: ProposedOwlGeometryWriter, mapping: OwlWriterMapping): number;
