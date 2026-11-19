/**
 * Original frog geometry, authored for this species. No asset/model/ASCII art
 * is traced or embedded. Surfaces and joints are sampled in model space; the
 * existing renderer receives finite world-space points through a local adapter.
 */
import { poseFrog } from './frog.mjs';
import type {
  FrogGeometryResult, FrogLandmarks, FrogPart, FrogPose, FrogSampleSink,
  FrogState, FrogView, GeometryOptions, LimbLandmarks, Vec3,
} from './types.mjs';

const TAU = 2 * Math.PI;
const CAPACITY = 32_000;
const GROUND = .62;
const clamp = (x: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, x));
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a: Vec3, n: number): Vec3 => v(a.x * n, a.y * n, a.z * n);
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
const subtract = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
function unit(p: Vec3): Vec3 {
  const length = Math.hypot(p.x, p.y, p.z);
  if (length < 1e-10) throw new RangeError('Degenerate frog geometry direction');
  return mul(p, 1 / length);
}

const YAW: Record<FrogView, number> = { front: 0, left: -.52, right: .52, profile: 1.25 };

function modelLandmarks(pose: FrogPose): FrogLandmarks {
  const e = clamp(pose.extension);
  const rear = (side: -1 | 1): LimbLandmarks => ({
    attachment: v(side * .43, .10, -.20),
    elbow: mix(v(side * .91, .23, -.02), v(side * .73, .43, -.37), e),
    ankle: mix(v(side * .64, .48, .32), v(side * .57, .78, -.61), e),
    tip: mix(v(side * 1.01, GROUND, .52), v(side * .64, 1.04, -.80), e),
  });
  const fore = (side: -1 | 1): LimbLandmarks => {
    // Asymmetry only bends the elbow. The planted wrist/toes never wander.
    const bend = .018 * Math.sin(pose.phase + (side < 0 ? .2 : 1.6));
    return {
      attachment: v(side * .48, -.09, .42),
      // The lower belly/forearm gap must survive the minimum cell grid.
      // Outward elbows keep an attached shoulder while exposing the limb.
      elbow: mix(v(side * (.70 + bend), .29, .55), v(side * .71, .10, .76), e),
      ankle: mix(v(side * .49, .56, .68), v(side * .71, .12, 1.02), e),
      tip: mix(v(side * .50, GROUND, .78), v(side * .76, .18, 1.19), e),
    };
  };
  return {
    torso: v(0, .10, -.10),
    head: v(0, -.26, .21),
    eyeLeft: v(-.48, -.54, .38),
    eyeRight: v(.48, -.54, .38),
    rearLeft: rear(-1), rearRight: rear(1),
    foreLeft: fore(-1), foreRight: fore(1),
  };
}

interface Transform {
  point(p: Vec3): Vec3;
  normal(n: Vec3): Vec3;
}

function transformation(pose: FrogPose, view: FrogView): Transform {
  if (!Object.hasOwn(YAW, view)) throw new RangeError('Unsupported frog view');
  const angle = YAW[view];
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const compression = clamp(pose.compression);
  const squash = 1 - compression * .37;
  const spread = 1 + compression * .075;
  const pitch = pose.airborne ? -.15 * clamp(pose.extension) : 0;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rotate = (p: Vec3): Vec3 => {
    const y = p.y * cp - p.z * sp, z = p.y * sp + p.z * cp;
    return v(p.x * ca + z * sa, y, -p.x * sa + z * ca);
  };
  return {
    point(p) {
      // Squash about the support plane. Unlike a uniform width scale, this
      // keeps x/y/z of every planted toe fixed through anticipation and impact.
      const aboveFoot = clamp((GROUND - p.y) / 1.2);
      const local = v(p.x * (1 + (spread - 1) * aboveFoot),
        GROUND + (p.y - GROUND) * squash, p.z + compression * .055 * aboveFoot);
      return add(pose.origin, mul(rotate(local), pose.scale));
    },
    normal(n) { return unit(rotate(v(n.x / spread, n.y / squash, n.z))); },
  };
}

/** Internal attachment shared with the tongue pass; not a new public option. */
export function frogMouthPoint(pose: FrogPose, view: FrogView = 'front'): Vec3 {
  return transformation(pose, view).point(mouthSurface(0));
}
function mouthSurface(x: number): Vec3 {
  const y = -.115 + .037 * (x / .59) ** 2;
  const r = 1 - (x / .77) ** 2 - ((y + .26) / .29) ** 2;
  return v(x, y, .21 + .53 * Math.sqrt(Math.max(.02, r)) + .014);
}

function transformLandmarks(landmarks: FrogLandmarks, transform: Transform): FrogLandmarks {
  const limb = (l: LimbLandmarks): LimbLandmarks => ({
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
export function frogLandmarks(state: FrogState, options: GeometryOptions = {}): FrogLandmarks {
  const pose = poseFrog(state, options);
  return transformLandmarks(modelLandmarks(pose), transformation(pose, options.view ?? 'front'));
}

/**
 * Emit all closed volumes and attached limbs. Sample order/IDs are invariant
 * across phases, seeds and views, so changing pose does not introduce random
 * glyph texture. Returned bounds include all emitted geometry.
 */
export function sampleFrog(state: FrogState, sink: FrogSampleSink, options: GeometryOptions = {}): FrogGeometryResult {
  if (typeof sink !== 'function') throw new TypeError('Frog sample sink must be a function');
  return sampleFrogPose(poseFrog(state, options), sink, options);
}

/**
 * The same anatomical model accepts an explicit posed root for pond direction.
 * No alternate mesh, sampling topology, or single-frog behavior is introduced.
 */
export function sampleFrogPose(pose: FrogPose, sink: FrogSampleSink, options: GeometryOptions = {}): FrogGeometryResult {
  if (typeof sink !== 'function') throw new TypeError('Frog sample sink must be a function');
  if (!pose || ![pose.origin.x, pose.origin.y, pose.origin.z, pose.scale,
      pose.compression, pose.extension, pose.throat, pose.gaze, pose.phase].every(Number.isFinite)
      || pose.scale <= 0) throw new TypeError('Frog pose must contain finite values and a positive scale');
  const transform = transformation(pose, options.view ?? 'front');
  const landmarks = modelLandmarks(pose);
  const lightDirection = unit(v(-.36, -.55, .76));
  const wetHighlight = unit(v(-.20, -.33, 1));
  let count = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  function emit(p: Vec3, normal: Vec3, part: FrogPart, material: 0 | 1 | 2 = 0, tone?: number): void {
    if (count >= CAPACITY) throw new RangeError('Frog sample capacity exceeded');
    const point = transform.point(p), n = transform.normal(normal);
    const diffuse = Math.max(0, dot(n, lightDirection));
    const rim = Math.pow(1 - Math.abs(n.z), 3);
    const skin = part === 'torso' || part === 'head' || part.startsWith('rear') || part.startsWith('fore');
    // Broad markings travel with the skin. A narrow coherent specular lobe
    // supplies wetness without frame-random sparkle or extra geometry.
    const marking = skin ? Math.sin(p.x * 7.2 + p.z * 3.1) * Math.sin(p.z * 5.3 - p.y * 3.0) : 0;
    const specular = .34 * Math.pow(Math.max(0, dot(n, wetHighlight)), 23);
    const gold = skin && p.y < .15 && marking > .43 && n.y < .4;
    const nostril = part === 'head' && p.z > .65 && Math.abs(Math.abs(p.x) - .21) < .037 && Math.abs(p.y + .29) < .032;
    const base = .18 + .48 * diffuse + .055 * rim + specular + (skin ? marking * .035 : .04);
    const light = options.silhouette ? .72 : clamp(tone ?? (nostril ? .08 : base + (part === 'throat' ? .13 : 0)), .025, 1);
    if (![point.x, point.y, point.z, light].every(Number.isFinite)) throw new RangeError('Non-finite frog sample');
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); maxZ = Math.max(maxZ, point.z);
    sink({ ...point, light, material: options.silhouette ? 0 : gold ? 2 : material, sampleId: count++, part });
  }

  function ellipsoid(center: Vec3, radius: Vec3, part: FrogPart, latitudes = 26, longitudes = 48, material: 0 | 1 | 2 = 0, tone?: number): void {
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

  function tube(from: Vec3, to: Vec3, startRadius: number, endRadius: number, part: FrogPart, rings = 20, sides = 16, tone?: number): void {
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

  function joint(center: Vec3, radius: number, part: FrogPart): void {
    ellipsoid(center, v(radius, radius, radius), part, 10, 18);
  }

  function rear(l: LimbLandmarks, side: -1 | 1): void {
    const part = side < 0 ? 'rear-left' : 'rear-right';
    tube(l.attachment, l.elbow, .22, .245, part, 24, 20);
    joint(l.elbow, .245, part);
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

  function fore(l: LimbLandmarks, side: -1 | 1): void {
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
  ellipsoid(landmarks.torso, v(.65, .35, .50), 'torso', 36, 64);
  ellipsoid(landmarks.head, v(.77, .29, .53), 'head', 32, 64);
  // The throat overlaps both head and torso and expands smoothly from its base.
  ellipsoid(v(0, .035, .49), v(.35 + pose.throat * .40, .14 + pose.throat, .12 + pose.throat), 'throat', 22, 38, 2);
  fore(landmarks.foreLeft, -1);
  fore(landmarks.foreRight, 1);

  function eye(center: Vec3, part: 'eye-left' | 'eye-right'): void {
    ellipsoid(center, v(.225, .205, .225), part, 24, 38);
    // Iris and pupil are slightly flattened ellipsoids sharing a globe center.
    // Their overlap preserves attachment in both front and oblique views.
    const iris = add(center, v(.025 * pose.gaze, -.008, .190));
    ellipsoid(iris, v(.169, .124, .057), part, 20, 34, 2, .80);
    const pupil = add(iris, v(.018 * pose.gaze, .006, .051));
    ellipsoid(pupil, v(.131, .044, .025), part, 14, 30, 2, .028);
    // Small reflection is a geometry patch, not an externally painted eye.
    ellipsoid(add(pupil, v(-.053, -.030, .021)), v(.026, .018, .012), part, 7, 12, 2, .96);
  }
  eye(landmarks.eyeLeft, 'eye-left');
  eye(landmarks.eyeRight, 'eye-right');

  // A shallow mouth seam follows the front of the cheek ellipsoid.
  for (let i = 0; i < 68; i++) {
    const x = -.59 + 1.18 * i / 67;
    const { y, z } = mouthSurface(x);
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
