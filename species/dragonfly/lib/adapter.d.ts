import type { Dragonfly, GeometryWriteResult, ProposedGeometryWriter, DragonflyMaterial } from './types.js';
/** Proposed mapping only. Coordinator must resolve the shared material table. */
export declare const PROPOSED_DRAGONFLY_MATERIALS: Readonly<Record<DragonflyMaterial, number>>;
/** Structurally fits PR2's documented GeometryWriter, not a released renderer API.
 * Validates capacity before any write. A writer that later refuses can have partial output;
 * the explicit result reports it. This does not execute arbitrary imported plugins.
 */
export declare function writeDragonflyGeometry(model: Dragonfly, writer: ProposedGeometryWriter): GeometryWriteResult;
