/**
 * Spring Pea R2: NEW private reconstruction from the retained concept and
 * canonical Frog geometry at 3b5ffcce. Not recovered bytes of the lost revision.
 * All default/source geometry remains untouched. Fixed topology:17,918 samples.
 */
import { poseSpringPea } from './pose.mjs';
const TAU = 2 * Math.PI;
const CAPACITY = 32_000;
const GROUND = .62;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a, n) => v(a.x * n, a.y * n, a.z * n);
const mix = (a, b, t) => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const subtract = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
function unit(p) {
    const length = Math.hypot(p.x, p.y, p.z);
    if (length < 1e-10)
        throw new RangeError('Degenerate frog geometry direction');
    return mul(p, 1 / length);
}
const YAW = { front: 0, left: -.52, right: .52, profile: 1.25 };
function modelLandmarks(pose) {
    const e = clamp(pose.extension);
    const tuck = pose.airborne ? (1 - e) * (1 - clamp(pose.compression / .7)) : 0;
    const rear = (side) => ({
        attachment: v(side * .35, .28, -.20),
        elbow: mix(mix(v(side * 1.08, .015, .03), v(side * .63, .28, .17), tuck), v(side * .73 - .26 * pose.gaze, .43, -.37), e),
        ankle: mix(mix(v(side * .89, .49, .32), v(side * .44, .54, .40), tuck), v(side * .57 - .44 * pose.gaze, .78, -.61), e),
        tip: mix(mix(v(side * 1.12, GROUND, .52), v(side * .50, .64, .57), tuck), v(side * .64 - .60 * pose.gaze, 1.04, -.80), e),
    });
    const fore = (side) => {
        // Asymmetry only bends the elbow. The planted wrist/toes never wander.
        const bend = .018 * Math.sin(pose.phase + (side < 0 ? .2 : 1.6));
        return {
            attachment: v(side * .44, -.02, .42),
            // The lower belly/forearm gap must survive the minimum cell grid.
            // Outward elbows keep an attached shoulder while exposing the limb.
            elbow: mix(mix(v(side * (.64 + bend), .33, .55), v(side * .42, .28, .61), tuck), v(side * .73 + .24 * pose.gaze, -.03, .76), e),
            ankle: mix(mix(v(side * .45, .56, .68), v(side * .24, .37, .75), tuck), v(side * .65 + .48 * pose.gaze, -.10, 1.02), e),
            tip: mix(mix(v(side * .46, GROUND, .78), v(side * .25, .40, .85), tuck), v(side * .66 + .62 * pose.gaze, -.11, 1.19), e),
        };
    };
    return {
        torso: v(0, .16, -.10),
        head: v(0, -.19, .21),
        eyeLeft: v(-.41, -.60, .40),
        eyeRight: v(.41, -.60, .40),
        rearLeft: rear(-1), rearRight: rear(1),
        foreLeft: fore(-1), foreRight: fore(1),
    };
}
function transformation(pose, view) {
    if (!Object.hasOwn(YAW, view))
        throw new RangeError('Unsupported frog view');
    const angle = YAW[view];
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const compression = clamp(pose.compression);
    const extension = clamp(pose.extension);
    const squash = (1 - compression * .46) * (1 + (pose.airborne ? .21 * extension : 0));
    const spread = 1 + compression * .19 - (pose.airborne ? .08 * extension : 0);
    const pitch = pose.airborne ? -.20 * extension : 0;
    const lean = pose.airborne ? -.36 * pose.gaze * extension : 0;
    const cl = Math.cos(lean), sl = Math.sin(lean);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rotate = (p) => {
        const y = p.y * cp - p.z * sp, z = p.y * sp + p.z * cp;
        const x = p.x * cl - y * sl, leanedY = p.x * sl + y * cl;
        return v(x * ca + z * sa, leanedY, -x * sa + z * ca);
    };
    return {
        point(p) {
            // Squash about the support plane. Unlike a uniform width scale, this
            // keeps x/y/z of every planted toe fixed through anticipation and impact.
            const aboveFoot = clamp((GROUND - p.y) / 1.2);
            const local = v(p.x * (1 + (spread - 1) * aboveFoot), GROUND + (p.y - GROUND) * squash, p.z + compression * .055 * aboveFoot);
            return add(pose.origin, mul(rotate(local), pose.scale));
        },
        normal(n) { return unit(rotate(v(n.x / spread, n.y / squash, n.z))); },
    };
}
/** Internal attachment shared with the tongue pass; not a new public option. */
export function springPeaMouthPoint(pose, view = 'front') {
    return transformation(pose, view).point(mouthSurface(0, pose));
}
function mouthSurface(x, pose) {
    const width = pose.airborne ? .31 : .64;
    const y = -.015 + (pose.airborne ? .065 : -.075) * (x / width) ** 2;
    const r = 1 - (x / .80) ** 2 - ((y + .19) / .31) ** 2;
    return v(x, y, .21 + .48 * Math.sqrt(Math.max(.02, r)) + .025);
}

function transformLandmarks(landmarks, transform) {
    const limb = (l) => ({
        attachment: transform.point(l.attachment), elbow: transform.point(l.elbow),
        ankle: transform.point(l.ankle), tip: transform.point(l.tip),
    });
    return {
        torso: transform.point(landmarks.torso), head: transform.point(landmarks.head),
        eyeLeft: transform.point(landmarks.eyeLeft), eyeRight: transform.point(landmarks.eyeRight),
        rearLeft: limb(landmarks.rearLeft), rearRight: limb(landmarks.rearRight),
        foreLeft: limb(landmarks.foreLeft), foreRight: limb(landmarks.foreRight),
    };
}
/** Posed anatomical landmarks use exactly the transforms used for the surfaces. */
export function springPeaLandmarks(state, options = {}) {
    const pose = poseSpringPea(state, options);
    return transformLandmarks(modelLandmarks(pose), transformation(pose, options.view ?? 'front'));
}
/**
 * Emit all closed volumes and attached limbs. Sample order/IDs are invariant
 * across phases, seeds and views, so changing pose does not introduce random
 * glyph texture. Returned bounds include all emitted geometry.
 */
export function sampleSpringPea(state, sink, options = {}) {
    if (typeof sink !== 'function')
        throw new TypeError('Frog sample sink must be a function');
    return sampleSpringPeaPose(poseSpringPea(state, options), sink, options);
}
/**
 * The same anatomical model accepts an explicit posed root for pond direction.
 * No alternate mesh, sampling topology, or single-frog behavior is introduced.
 */
export function sampleSpringPeaPose(pose, sink, options = {}) {
    if (typeof sink !== 'function')
        throw new TypeError('Frog sample sink must be a function');
    if (!pose || ![pose.origin.x, pose.origin.y, pose.origin.z, pose.scale,
        pose.compression, pose.extension, pose.throat, pose.gaze, pose.phase].every(Number.isFinite)
        || pose.scale <= 0)
        throw new TypeError('Frog pose must contain finite values and a positive scale');
    const transform = transformation(pose, options.view ?? 'front');
    const landmarks = modelLandmarks(pose);
    const lightDirection = unit(v(-.36, -.55, .76));
    let count = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    function emit(p, normal, part, material = 0, tone) {
        if (count >= CAPACITY)
            throw new RangeError('Frog sample capacity exceeded');
        const point = transform.point(p), n = transform.normal(normal);
        const diffuse = Math.max(0, dot(n, lightDirection));
        // Three coherent cel tones; no per-sample markings or specular noise.
        const base = diffuse > .56 ? .84 : diffuse > .12 ? .68 : .47;
        const light = options.silhouette ? .72 : clamp(tone ?? base, .025, 1);
        if (![point.x, point.y, point.z, light].every(Number.isFinite))
            throw new RangeError('Non-finite frog sample');
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        minZ = Math.min(minZ, point.z);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        maxZ = Math.max(maxZ, point.z);
        sink({ ...point, light, material: options.silhouette ? 0 : material, sampleId: count++, part });
    }
    function ellipsoid(center, radius, part, latitudes = 26, longitudes = 48, material = 0, tone) {
        for (let iy = 0; iy <= latitudes; iy++) {
            const phi = -Math.PI / 2 + Math.PI * iy / latitudes;
            const cp = Math.cos(phi), sp = Math.sin(phi);
            for (let ix = 0; ix < longitudes; ix++) {
                const theta = TAU * ix / longitudes;
                const cx = Math.cos(theta), sz = Math.sin(theta);
                const normal = v(cp * cx / radius.x, sp / radius.y, cp * sz / radius.z);
                emit(v(center.x + radius.x * cp * cx, center.y + radius.y * sp, center.z + radius.z * cp * sz), normal, part, material, tone);
            }
        }
    }
    function tube(from, to, startRadius, endRadius, part, rings = 20, sides = 16, tone) {
        const axis = unit(subtract(to, from));
        const reference = Math.abs(axis.y) < .8 ? v(0, 1, 0) : v(1, 0, 0);
        const tangent = unit(cross(axis, reference)), bitangent = cross(axis, tangent);
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            const center = mix(from, to, t);
            // A modest belly gives muscular thighs while endpoints share radii with
            // the joint spheres. Geometry is a continuous tube, never separated beads.
            const thigh = part.startsWith('rear') && startRadius > .2;
            const radius = startRadius + (endRadius - startRadius) * t + (thigh ? .055 * Math.sin(Math.PI * t) : 0);
            for (let j = 0; j < sides; j++) {
                const angle = TAU * j / sides;
                const radial = add(mul(tangent, Math.cos(angle)), mul(bitangent, Math.sin(angle)));
                emit(add(center, mul(radial, radius)), radial, part, 0, tone);
            }
        }
    }
    function joint(center, radius, part) {
        ellipsoid(center, v(radius, radius, radius), part, 10, 18);
    }
    function rear(l, side) {
        const part = side < 0 ? 'rear-left' : 'rear-right';
        tube(l.attachment, l.elbow, .17, .25, part, 24, 20);
        // Tall oval haunches read as folded springs instead of a horizontal bar.
        ellipsoid(l.elbow, v(.26, .35, .24), part, 10, 18);
        tube(l.elbow, l.ankle, .12, .07, part, 24, 18);
        joint(l.ankle, .087, part);
        tube(l.ankle, l.tip, .075, .053, part, 18, 14);
        ellipsoid(l.tip, v(.16, .045, .11), part, 8, 16);
        for (let digit = -1; digit <= 1; digit++) {
            const toe = add(l.tip, v(side * .13 + digit * .06, -.005 + Math.abs(digit) * .008, .10 + .045 * (1 - Math.abs(digit))));
            tube(l.tip, toe, .034, .026, part, 7, 8);
            ellipsoid(toe, v(.04, .026, .04), part, 6, 10);
        }
    }
    function fore(l, side) {
        const part = side < 0 ? 'fore-left' : 'fore-right';
        tube(l.attachment, l.elbow, .108, .078, part, 23, 16);
        joint(l.elbow, .079, part);
        tube(l.elbow, l.ankle, .071, .048, part, 21, 14);
        joint(l.ankle, .05, part);
        tube(l.ankle, l.tip, .045, .035, part, 9, 12);
        ellipsoid(l.tip, v(.083, .032, .062), part, 8, 16);
        for (let digit = -1; digit <= 1; digit++) {
            const toe = add(l.tip, v(digit * .079, -.003, .11 - Math.abs(digit) * .026));
            tube(l.tip, toe, .025, .019, part, 8, 8);
            ellipsoid(toe, v(.032, .021, .033), part, 6, 10);
        }
    }
    // Rear legs come from the body's hip surface. They are emitted first, but
    // true z-depth, not painter's order, decides which parts are visible.
    rear(landmarks.rearLeft, -1);
    rear(landmarks.rearRight, 1);
    // The raised lower belly reserves a negative wedge beside each forearm.
    // Legibility of this new reconstruction is checked in R2's own captures.
    ellipsoid(landmarks.torso, v(.55, .34, .47), 'torso', 36, 64);
    ellipsoid(landmarks.head, v(.80, .31, .48), 'head', 32, 64);
    // The throat overlaps both head and torso and expands smoothly from its base.
    ellipsoid(v(0, .17, .48), v(.35 + pose.throat * .35, .215 + pose.throat, .13 + pose.throat), 'throat', 22, 38, 2, .88);
    fore(landmarks.foreLeft, -1);
    fore(landmarks.foreRight, 1);
    function eye(center, part) {
        const squeeze = clamp(pose.compression);
        const eyeHeight = (pose.airborne ? .35 : .305) * (1 - squeeze * .32);
        // Cream domes sit on attached green rims in every supported view.
        ellipsoid(center, v(.38, eyeHeight + .025, .245), part, 24, 38);
        const iris = add(center, v(.015 * pose.gaze, -.008, .185));
        ellipsoid(iris, v(.35, eyeHeight, .085), part, 20, 34, 2, .96);
        const pupil = add(iris, v(.075 * pose.gaze, .020 + squeeze * .018, .074));
        const pupilWidth = pose.airborne ? .087 : .112 + squeeze * .018;
        const pupilHeight = pose.airborne ? .115 : .163 * (1 - squeeze * .65);
        ellipsoid(pupil, v(pupilWidth, pupilHeight, .029), part, 14, 30, 2, .028);
        ellipsoid(add(pupil, v(-.035, -.055 * (1 - squeeze), .026)), v(.029, .029, .012), part, 7, 12, 2, 1);
    }
    eye(landmarks.eyeLeft, 'eye-left');
    eye(landmarks.eyeRight, 'eye-right');
    // A shallow mouth seam follows the front of the cheek ellipsoid.
    for (let i = 0; i < 68; i++) {
        const width = pose.airborne ? .31 : .64;
        const x = -width + 2 * width * i / 67;
        const { y, z } = mouthSurface(x, pose);
        for (let j = 0; j < 4; j++) {
            const angle = TAU * j / 4;
            emit(v(x, y + .018 * Math.sin(angle), z + .015 * Math.cos(angle)), v(0, Math.sin(angle), Math.cos(angle)), 'mouth', 2, .055);
        }
    }
    return {
        count,
        bounds: { min: v(minX, minY, minZ), max: v(maxX, maxY, maxZ) },
        landmarks: transformLandmarks(landmarks, transform),
    };
}
