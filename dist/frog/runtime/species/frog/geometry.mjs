/**
 * Original frog geometry, authored for this species. No asset/model/ASCII art
 * is traced or embedded. Surfaces and joints are sampled in model space; the
 * existing renderer receives finite world-space points through a local adapter.
 */
import { poseFrog } from './frog.mjs';
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
    const rear = (side) => ({
        attachment: v(side * .48, .06, -.08),
        elbow: mix(v(side * .94, .22, -.09), v(side * .76, .42, -.30), e),
        ankle: mix(v(side * .68, .48, .18), v(side * .57, .77, -.50), e),
        tip: mix(v(side * 1.02, GROUND, .39), v(side * .66, 1.02, -.72), e),
    });
    const fore = (side) => {
        // Asymmetry only bends the elbow. The planted wrist/toes never wander.
        const bend = .018 * Math.sin(pose.phase + (side < 0 ? .2 : 1.6));
        return {
            attachment: v(side * .49, -.16, .37),
            // The lower belly/forearm gap must survive the minimum cell grid.
            // Outward elbows keep an attached shoulder while exposing the limb.
            elbow: mix(v(side * (.70 + bend), .28, .51), v(side * .71, .10, .76), e),
            ankle: mix(v(side * .49, .56, .68), v(side * .71, .12, 1.02), e),
            tip: mix(v(side * .50, GROUND, .78), v(side * .76, .18, 1.19), e),
        };
    };
    return {
        torso: v(0, .06, -.03),
        head: v(0, -.31, .16),
        eyeLeft: v(-.49, -.61, .35),
        eyeRight: v(.49, -.61, .35),
        rearLeft: rear(-1), rearRight: rear(1),
        foreLeft: fore(-1), foreRight: fore(1),
    };
}
function transformation(pose, view) {
    if (!Object.hasOwn(YAW, view))
        throw new RangeError('Unsupported frog view');
    const angle = YAW[view];
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const squash = 1 - clamp(pose.compression) * .22;
    const spread = 1 + clamp(pose.compression) * .055;
    const rotate = (p) => v(p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca);
    return {
        point(p) {
            const local = v(p.x * spread, GROUND + (p.y - GROUND) * squash, p.z);
            return add(pose.origin, mul(rotate(local), pose.scale));
        },
        normal(n) { return unit(rotate(v(n.x / spread, n.y / squash, n.z))); },
    };
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
export function frogLandmarks(state, options = {}) {
    const pose = poseFrog(state, options);
    return transformLandmarks(modelLandmarks(pose), transformation(pose, options.view ?? 'front'));
}
/**
 * Emit all closed volumes and attached limbs. Sample order/IDs are invariant
 * across phases, seeds and views, so changing pose does not introduce random
 * glyph texture. Returned bounds include all emitted geometry.
 */
export function sampleFrog(state, sink, options = {}) {
    if (typeof sink !== 'function')
        throw new TypeError('Frog sample sink must be a function');
    return sampleFrogPose(poseFrog(state, options), sink, options);
}
/**
 * The same anatomical model accepts an explicit posed root for pond direction.
 * No alternate mesh, sampling topology, or single-frog behavior is introduced.
 */
export function sampleFrogPose(pose, sink, options = {}) {
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
        const rim = Math.pow(1 - Math.abs(n.z), 3);
        // Mottling is fixed in local coordinates. No clock or random value enters
        // shading, so the markings follow the same skin through every movement.
        const mottling = part === 'torso' || part === 'head'
            ? .026 * Math.sin(p.x * 17 + p.z * 11) * Math.sin(p.y * 14 - p.z * 7) : 0;
        const light = options.silhouette ? .72 : clamp(tone ?? (.22 + .58 * diffuse + .12 * rim + mottling), .025, 1);
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
            const radius = startRadius + (endRadius - startRadius) * t;
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
        tube(l.attachment, l.elbow, .22, .225, part, 24, 20);
        joint(l.elbow, .225, part);
        tube(l.elbow, l.ankle, .155, .085, part, 24, 18);
        joint(l.ankle, .087, part);
        tube(l.ankle, l.tip, .075, .053, part, 18, 14);
        ellipsoid(l.tip, v(.12, .045, .10), part, 8, 16);
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
    // Raised lower belly creates a readable wedge beside each forearm; this
    // bounded refinement follows the first actual native-atlas contact sheet.
    ellipsoid(landmarks.torso, v(.72, .40, .43), 'torso', 36, 64);
    ellipsoid(landmarks.head, v(.78, .31, .47), 'head', 32, 64);
    // The throat overlaps both head and torso and expands smoothly from its base.
    ellipsoid(v(0, .02, .45), v(.31 + pose.throat * .40, .18 + pose.throat, .12 + pose.throat), 'throat', 22, 38, 2);
    fore(landmarks.foreLeft, -1);
    fore(landmarks.foreRight, 1);
    function eye(center, part) {
        ellipsoid(center, v(.245, .245, .235), part, 24, 38);
        // Iris and pupil are slightly flattened ellipsoids sharing a globe center.
        // Their overlap preserves attachment in both front and oblique views.
        const iris = add(center, v(.025 * pose.gaze, -.008, .194));
        ellipsoid(iris, v(.174, .160, .060), part, 20, 34, 2, .79);
        const pupil = add(iris, v(.018 * pose.gaze, .006, .051));
        ellipsoid(pupil, v(.128, .060, .025), part, 14, 30, 2, .028);
        // Small reflection is a geometry patch, not an externally painted eye.
        ellipsoid(add(pupil, v(-.053, -.030, .021)), v(.026, .018, .012), part, 7, 12, 2, .96);
    }
    eye(landmarks.eyeLeft, 'eye-left');
    eye(landmarks.eyeRight, 'eye-right');
    // A shallow mouth seam follows the front of the cheek ellipsoid.
    for (let i = 0; i < 68; i++) {
        const x = -.59 + 1.18 * i / 67;
        const y = -.147 + .048 * (x / .59) ** 2;
        const r = 1 - (x / .78) ** 2 - ((y + .31) / .31) ** 2;
        const z = .16 + .47 * Math.sqrt(Math.max(.02, r)) + .012;
        for (let j = 0; j < 4; j++) {
            const angle = TAU * j / 4;
            emit(v(x, y + .011 * Math.sin(angle), z + .010 * Math.cos(angle)), v(0, Math.sin(angle), Math.cos(angle)), 'mouth', 2, .055);
        }
    }
    return {
        count,
        bounds: { min: v(minX, minY, minZ), max: v(maxX, maxY, maxZ) },
        landmarks: transformLandmarks(landmarks, transform),
    };
}
