/** Frog-local presentation math. Pure, bounded, and driven by model tick age. */
import { clamp } from './frog.mjs';
const smooth = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
/** Deliberately slowed for ASCII readability; these are authored timings. */
export function tongueMotion(age, duration, missed = false) {
    const u = clamp(age / duration, 0, 1);
    const phase = u < .1 ? 'prepare' : u < .3 ? 'project' : u < .4 ? 'contact' : u < .85 ? 'return' : 'swallow';
    const reach = u < .3 ? smooth((u - .1) / .2) : u < .4 ? 1 : 1 - smooth((u - .4) / .45);
    // A blocked approach may attempt a short strike, but never depict contact.
    return Object.freeze({ reach: reach * (missed ? .65 : 1), contact: !missed && u >= .3, phase });
}
/** One shared point is used by the insect and the tongue's contact endpoint. */
export function insectHover(contact, scale, tick, side, motion) {
    return Object.freeze({
        x: contact.x + side * 1.45 * scale + (motion ? .035 * scale * Math.sin(tick / 17) : 0),
        y: contact.y - 1.12 * scale + (motion ? .03 * scale * Math.cos(tick / 11) : 0),
        z: 2.08,
    });
}
/** The visible prey and projected tongue share one bounded contact point. */
export function tongueTarget(mouth, hover, scale) {
    const distance = Math.hypot(hover.x - mouth.x, hover.y - mouth.y);
    const ratio = Math.min(1, 1.65 * scale / Math.max(.0001, distance));
    return Object.freeze({ x: mouth.x + (hover.x - mouth.x) * ratio,
        y: mouth.y + (hover.y - mouth.y) * ratio, z: hover.z });
}
/** Soft sag on return, with exact mouth/root and prey/tip attachment. */
export function tonguePoint(mouth, insect, reach, along, scale) {
    const u = clamp(along, 0, 1), amount = clamp(reach, 0, 1);
    return Object.freeze({
        x: mouth.x + (insect.x - mouth.x) * amount * u,
        y: mouth.y + (insect.y - mouth.y) * amount * u + .075 * scale * Math.sin(Math.PI * u) * amount * (1 - amount),
        z: mouth.z + (insect.z - mouth.z) * u,
    });
}
