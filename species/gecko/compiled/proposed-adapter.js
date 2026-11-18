/**
 * Compatibility proposal ONLY for PR #2 e7c1610 docs/EXTENDING.md.
 * That sketch is not exported by main or by the draft package. No shared
 * implementation is imported here. The coordinator must accept material,
 * coordinate, clock and lifecycle semantics before integrating this adapter.
 */
import { createGecko, GECKO_LIMITS } from './gecko.js';
import { sampleGecko } from './geometry.js';
/** Host supplies material IDs; the current cuttlefish atlas is not assumed. */
export function createProposedGeckoDefinition(materialIds) {
    if (!materialIds || Object.keys(materialIds).length !== 4)
        throw new TypeError('Provide four explicit gecko material IDs');
    for (const key of ['skin', 'pad', 'eye', 'pupil']) {
        if (!Number.isSafeInteger(materialIds[key]) || materialIds[key] < 0 || materialIds[key] > 65535)
            throw new RangeError(`Invalid material ID: ${key}`);
    }
    const ids = { ...materialIds };
    return {
        maxSamples: GECKO_LIMITS.samples,
        create(options, seed) { return { model: createGecko({ seed, options }) }; },
        update(state, input, dtSeconds) {
            if (!Number.isFinite(dtSeconds) || Math.abs(dtSeconds - 1 / 60) > 1e-12)
                throw new RangeError('Proposed gecko adapter requires exactly one 1/60s tick');
            state.model.step(input);
        },
        sample(state, writer) {
            if (!Number.isSafeInteger(writer.capacity) || !Number.isSafeInteger(writer.count) || writer.count < 0 || writer.capacity - writer.count < GECKO_LIMITS.samples) {
                throw new RangeError('Reserve the full declared gecko sample capacity before writing');
            }
            sampleGecko(state.model.getSnapshot(), p => {
                if (!writer.write(p.x, p.y, p.z, p.tone, ids[p.material], p.stableId))
                    throw new Error('Geometry writer rejected a sample; discard this host frame');
            });
        },
        describe(state) { return `A pad-toed gecko with a broad head and continuous tail; ${state.model.getSnapshot().behavior.kind}.`; },
    };
}
