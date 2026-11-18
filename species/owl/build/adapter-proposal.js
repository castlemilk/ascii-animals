const materials = ['feather', 'disk', 'eye', 'pupil', 'highlight', 'beak', 'foot', 'wood'];
/**
 * Demonstrates an explicit mapping only. Requires a trusted synchronous writer.
 * Capacity/values are checked before the first write. If the host unexpectedly
 * refuses a write/throws, discard that destination frame; rollback is not implied.
 * Include/exclude the perch by filtering the caller's sample list explicitly.
 */
export function writeOwlSamplesToProposal(samples, writer, mapping) {
    if (!Array.isArray(samples) || samples.length > 14400)
        throw new RangeError('Owl adapter sample budget is 14400');
    if (!writer || typeof writer.write !== 'function' || !Number.isSafeInteger(writer.capacity) || !Number.isSafeInteger(writer.count)
        || writer.capacity < 0 || writer.count < 0 || writer.count > writer.capacity)
        throw new TypeError('Invalid proposed geometry writer');
    if (writer.capacity - writer.count < samples.length)
        throw new RangeError('Proposed writer has insufficient capacity');
    if (!mapping || !mapping.materials || typeof mapping.unitsPerLocalUnit !== 'number' || !Number.isFinite(mapping.unitsPerLocalUnit)
        || mapping.unitsPerLocalUnit <= 0 || mapping.unitsPerLocalUnit > 10 || !['up', 'down'].includes(mapping.yAxis))
        throw new TypeError('Explicit finite units, y axis and material mapping required');
    for (const material of materials) {
        const code = mapping.materials[material];
        if (!Number.isSafeInteger(code) || code < 0 || code > 65535)
            throw new RangeError(`Invalid host material ID for ${material}`);
    }
    for (const point of samples) {
        if (!point || !materials.includes(point.material) || ![point.x, point.y, point.z, point.tone].every(v => typeof v === 'number' && Number.isFinite(v))
            || Math.abs(point.x) > 3 || Math.abs(point.y) > 3 || Math.abs(point.z) > 3 || point.tone < 0 || point.tone > 1)
            throw new TypeError('Invalid Owl sample');
    }
    const scale = mapping.unitsPerLocalUnit;
    for (let i = 0; i < samples.length; i++) {
        const point = samples[i];
        if (!writer.write(point.x * scale, point.y * scale * (mapping.yAxis === 'up' ? -1 : 1), point.z * scale, point.tone, mapping.materials[point.material], i))
            throw new Error(`Proposed writer rejected sample ${i}; discard destination frame`);
    }
    return samples.length;
}
