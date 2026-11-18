/** Proposed mapping only. Coordinator must resolve the shared material table. */
export const PROPOSED_DRAGONFLY_MATERIALS = Object.freeze({
    body: 0, band: 1, wing: 2, vein: 3, eye: 4, leg: 5,
});
/** Structurally fits PR2's documented GeometryWriter, not a released renderer API.
 * Validates capacity before any write. A writer that later refuses can have partial output;
 * the explicit result reports it. This does not execute arbitrary imported plugins.
 */
export function writeDragonflyGeometry(model, writer) {
    if (!writer || typeof writer.write !== 'function')
        throw new TypeError('Expected a geometry writer');
    if (!Number.isSafeInteger(writer.capacity) || writer.capacity < 0 || writer.capacity > 100000 ||
        !Number.isSafeInteger(writer.count) || writer.count < 0 || writer.count > writer.capacity)
        throw new RangeError('Invalid writer capacity/count');
    const geometry = model.sample(), required = geometry.samples.length;
    if (writer.capacity - writer.count < required)
        return { kind: 'insufficient-capacity', written: 0, required };
    let written = 0;
    for (const p of geometry.samples) {
        if (!writer.write(p.x, p.y, p.z, p.tone, PROPOSED_DRAGONFLY_MATERIALS[p.material], p.stableIndex))
            return { kind: 'writer-rejected', written, required };
        written++;
    }
    return { kind: 'complete', written, required };
}
