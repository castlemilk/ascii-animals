import type { DragonflyGeometry, DragonflyMaterial, DragonflyOptions, DragonflyPart,
  DragonflySample, DragonflyState, Vec3, WingId, WingLandmark } from './types.js';

const TAU = Math.PI * 2;
const MAX_SAMPLES = 6144;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Original parameterized dragonfly anatomy. No view, rasterizer or clock ownership. */
export function buildDragonflyGeometry(state: DragonflyState, config: Readonly<DragonflyOptions>): DragonflyGeometry {
  const samples: DragonflySample[] = [], wings: WingLandmark[] = [];
  const c = Math.cos(state.heading), s = Math.sin(state.heading);
  const transform = (x: number, y: number, z: number): Vec3 => ({
    x: state.position.x + c*x - s*y, y: state.position.y + s*x + c*y, z,
  });
  const emit = (x: number, y: number, z: number, tone: number, material: DragonflyMaterial, part: DragonflyPart): void => {
    if (samples.length >= MAX_SAMPLES) throw new RangeError('Dragonfly geometry exceeded its sample budget');
    const point = transform(x, y, z);
    if (![point.x, point.y, point.z, tone].every(Number.isFinite)) throw new RangeError('Nonfinite dragonfly geometry');
    samples.push({ ...point, tone: clamp01(tone), material, part, stableIndex: samples.length });
  };
  const ellipsoid = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
    material: DragonflyMaterial, part: DragonflyPart, latitude = 10, longitude = 20): void => {
    for (let row = 0; row <= latitude; row++) {
      const polar = row / latitude * Math.PI;
      for (let col = 0; col < longitude; col++) {
        const phi = col / longitude * TAU, ny = Math.cos(polar);
        const nx = Math.sin(polar)*Math.cos(phi), nz = Math.sin(polar)*Math.sin(phi);
        const light = material === 'eye' ? .72 + .26*Math.max(0,nz) : .29 + .48*Math.max(0,nz) + .12*Math.max(0,-nx);
        emit(cx+nx*rx, cy+ny*ry, cz+nz*rz, light, material, part);
      }
    }
  };
  const beat = config.motion === 'static' ? 0 : state.wingPhase;
  const seedOffset = ((Math.imul(state.seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const wingSpecs: readonly { id: WingId; side: -1 | 1; hind: boolean; offset: number }[] = [
    { id: 'left-fore', side: -1, hind: false, offset: .1 },
    { id: 'right-fore', side: 1, hind: false, offset: 1.05 },
    { id: 'left-hind', side: -1, hind: true, offset: 2.05 },
    { id: 'right-hind', side: 1, hind: true, offset: 3.25 },
  ];
  for (const wing of wingSpecs) {
    const rootX = wing.side*.12, rootY = wing.hind ? .045 : -.19, rootZ = -.015;
    const angle = config.motion === 'static' ? (state.staticPose ? .22 : .06) * (wing.hind ? -1 : 1) :
      Math.sin(beat + wing.offset + seedOffset*.45)*config.wingAmplitude;
    const span = wing.hind ? 1.40 : 1.52, sweep = wing.hind ? .49 : -.43;
    const chord = wing.hind ? .16 : .115;
    const pointAt = (u: number, v: number): [number, number, number] => {
      const width = chord*Math.pow(Math.max(0, Math.sin(Math.PI*u)), .65);
      return [rootX + wing.side*span*u*Math.cos(angle),
        rootY + sweep*u + .06*Math.sin(Math.PI*u) + v*width,
        rootZ + Math.sin(angle)*span*u + .025*Math.sin(Math.PI*u)*(1-v*v)];
    };
    const tip = pointAt(1, 0);
    wings.push({ id: wing.id, root: transform(rootX, rootY, rootZ), tip: transform(...tip), angle });
    // Root appears explicitly in each blade's samples; every deformation is relative to it.
    emit(rootX, rootY, rootZ, .8, 'vein', wing.id);
    for (let row = 1; row <= 50; row++) {
      const u = row / 50;
      for (let column = -3; column <= 3; column++) {
        const v = column / 3, point = pointAt(u, v);
        const edge = Math.abs(column) === 3;
        emit(...point, edge ? .66 : .23 + .09*(1-v*v), edge ? 'vein' : 'wing', wing.id);
      }
    }
    // Two longitudinal veins and sparse transverse veins, authored analytically.
    for (let row = 1; row <= 50; row++) for (const v of [-.36, .36])
      emit(...pointAt(row/50, v), .48, 'vein', wing.id);
    for (let row = 8; row < 47; row += 6) for (let column = -3; column <= 3; column++) {
      const point = pointAt(row/50 + column*.0018, column/3);
      emit(point[0], point[1], point[2]+.002, .42, 'vein', wing.id);
    }
  }
  // Six bent legs beneath the thorax; no detached decorative flecks.
  for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
    const y = -.16 + leg*.12;
    const points: [number,number,number][] = [[side*.11,y,-.06], [side*(.24+leg*.025),y-.19,-.08],
      [side*(.29+leg*.025),y-.34,-.035]];
    for (let segment = 0; segment < 2; segment++) {
      const from = points[segment]!, to = points[segment+1]!;
      for (let step = 0; step <= 12; step++) {
        const u = step/12;
        emit(from[0]+(to[0]-from[0])*u, from[1]+(to[1]-from[1])*u,
          from[2]+(to[2]-from[2])*u, .57, 'leg', 'legs');
      }
    }
  }
  ellipsoid(0,-.04,.025,.18,.31,.14,'body','thorax',12,24);
  ellipsoid(0,-.43,.045,.20,.135,.12,'body','head',8,20);
  // Leave a medial valley: overlapping eye domes became one bright cap at 72x44.
  const eyes: [Vec3,Vec3] = [transform(-.17,-.51,.12),transform(.17,-.51,.12)];
  ellipsoid(-.17,-.51,.12,.128,.138,.135,'eye','left-eye',10,20);
  ellipsoid(.17,-.51,.12,.128,.138,.135,'eye','right-eye',10,20);
  // Ten connected tapering segments with dark collars, rather than a single tail line.
  // Integer periodicity matters because wingPhase wraps at 2pi. The previous
  // fractional harmonic jumped at every wrap; this smaller curve is continuous.
  const curve = (u: number): number => Math.sin(beat + seedOffset*TAU)*.016*u*u;
  for (let segment = 0; segment < 10; segment++) {
    const start = .20 + segment*.145, radius = .122 - segment*.0087;
    for (let row = 0; row <= 6; row++) {
      const u = row/6, y = start + u*.145;
      const collar = row === 0 || row === 6, bulge = .84 + .16*Math.sin(u*Math.PI);
      for (let col = 0; col < 18; col++) {
        const theta = col/18*TAU, nz = Math.sin(theta);
        emit(curve((y-.20)/1.45) + Math.cos(theta)*radius*bulge, y,
          .025 + nz*radius*.75, collar ? .29 : .50+.34*Math.max(0,nz), collar ? 'band' : 'body', 'abdomen');
      }
    }
  }
  const abdomenTip = transform(curve(1),1.65,.025);
  return { samples, wings, eyes, abdomenTip };
}
