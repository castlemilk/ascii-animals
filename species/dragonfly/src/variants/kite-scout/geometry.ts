import type { DragonflyGeometry, DragonflyMaterial, DragonflyOptions, DragonflyPart,
  DragonflySample, DragonflyState, Vec3, WingId, WingLandmark } from './types.js';

const TAU = Math.PI * 2;
const MAX_SAMPLES = 6144;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Species-private articulation. Feet still meet the director's transverse twig. */
export interface DragonflyArticulation { readonly pitch: number; readonly grip: number }
const FLIGHT: DragonflyArticulation = Object.freeze({ pitch: 0, grip: 0 });

/** Kite Scout: original graphic anatomy. Four attached blades, two readable eyes,
 * and ten linked abdomen segments. Stroke hints are printable ASCII; geometry
 * and all posing remain pure functions of the explicit species snapshot. */
export function buildDragonflyGeometry(state: DragonflyState, config: Readonly<DragonflyOptions>, pose: DragonflyArticulation = FLIGHT): DragonflyGeometry {
  const samples: DragonflySample[] = [], wings: WingLandmark[] = [];
  const c = Math.cos(state.heading), s = Math.sin(state.heading), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
  const transform = (x: number, y: number, z: number): Vec3 => {
    const py = y*cp-z*sp, pz = y*sp+z*cp;
    return { x: state.position.x+c*x-s*py, y: state.position.y+s*x+c*py, z: pz };
  };
  const emit = (x: number, y: number, z: number, tone: number, material: DragonflyMaterial, part: DragonflyPart, glyph?: string): void => {
    if (samples.length >= MAX_SAMPLES) throw new RangeError('Dragonfly geometry exceeded its sample budget');
    const point = transform(x, y, z);
    if (![point.x, point.y, point.z, tone].every(Number.isFinite)) throw new RangeError('Nonfinite dragonfly geometry');
    samples.push({ ...point, tone: clamp01(tone), material, part, stableIndex: samples.length,
      ...(glyph === undefined ? {} : { glyph }) });
  };
  type Point = [number, number, number];
  const stroke = (from: Point, to: Point, material: DragonflyMaterial, part: DragonflyPart, count = 10, override?: string): void => {
    const a = transform(...from), b = transform(...to), dx = b.x-a.x, dy = b.y-a.y;
    const glyph = override ?? (Math.abs(dy) < Math.abs(dx)*.36 ? '-' : Math.abs(dx) < Math.abs(dy)*.34 ? '|' : dx*dy > 0 ? '\\' : '/');
    for (let i = 0; i <= count; i++) {
      const u = i/count;
      emit(from[0]+(to[0]-from[0])*u, from[1]+(to[1]-from[1])*u,
        from[2]+(to[2]-from[2])*u, .8, material, part, glyph);
    }
  };
  const disc = (cx: number, cy: number, z: number, rx: number, ry: number, material: DragonflyMaterial, part: DragonflyPart, glyph: string): void => {
    for (let row = -7; row <= 7; row++) for (let col = -7; col <= 7; col++) {
      const x = col/7, y = row/7;
      if (x*x+y*y <= 1) emit(cx+x*rx, cy+y*ry, z+.008*(1-x*x-y*y), .8, material, part, glyph);
    }
  };
  const beat = config.motion === 'static' ? 0 : state.wingPhase;
  const seedOffset = ((Math.imul(state.seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const progress = state.behavior.kind === 'dart' ? state.behavior.elapsed/state.behavior.duration : 1;
  const release=clamp01((progress-.3)/.2);
  const load = state.behavior.kind === 'dart' ? progress<=.3 ? Math.sin(Math.PI*progress/.6) :
    1-release*release*(3-2*release) : 0;
  const brake = state.behavior.kind === 'recover' ? Math.max(0, 1-state.behavior.elapsed/Math.min(24,state.behavior.duration)) : 0;
  const wingSpecs: readonly { id: WingId; side: -1 | 1; hind: boolean; offset: number }[] = [
    { id: 'left-fore', side: -1, hind: false, offset: .06 },
    { id: 'right-fore', side: 1, hind: false, offset: .22 },
    { id: 'left-hind', side: -1, hind: true, offset: Math.PI+.23 },
    { id: 'right-hind', side: 1, hind: true, offset: Math.PI+.39 },
  ];
  for (const wing of wingSpecs) {
    const rootX = wing.side*.12, rootY = wing.hind ? .045 : -.19, rootZ = -.015;
    const cycle = Math.sin(beat + wing.offset + seedOffset*.45);
    const angle = config.motion === 'static' ? (state.staticPose ? .22 : .06)*(wing.hind ? -1 : 1) :
      Math.max(-1,Math.min(1,cycle*(1-.65*load-.3*brake)+(wing.hind ? -1 : 1)*load*.65))*config.wingAmplitude;
    const span = wing.hind ? 1.40 : 1.52, sweep = wing.hind ? .55 : -.51;
    const chord = wing.hind ? .30 : .205;
    const pointAt = (u: number, v: number): Point => {
      const width = chord*Math.pow(Math.max(0,Math.sin(Math.PI*u)),wing.hind ? .65 : .85)*(wing.hind ? 1-.28*u : 1);
      return [rootX+wing.side*span*u*Math.cos(angle), rootY+sweep*u+.06*Math.sin(Math.PI*u)+v*width,
        rootZ+Math.sin(angle)*span*u+.025*Math.sin(Math.PI*u)*(1-v*v)];
    };
    const tip = pointAt(1,0);
    wings.push({ id:wing.id, root:transform(rootX,rootY,rootZ), tip:transform(...tip), angle });
    emit(rootX,rootY,rootZ,.8,'vein',wing.id,'=');
    // One clean outline and one short leading spar. No vein lattice or stippled membrane.
    for (const edge of [-1,1]) for (let row=0; row<24; row++)
      stroke(pointAt(row/24,edge),pointAt((row+1)/24,edge),wing.hind ? 'wing' : 'vein',wing.id,2);
    for (let row=2; row<18; row++) {
      const a=pointAt(row/24,-.18),b=pointAt((row+1)/24,-.18);
      stroke(a,b,'wing',wing.id,1);
    }
    for (let row=19; row<=21; row++) {
      const p=pointAt(row/24,-.8);
      emit(p[0],p[1],p[2]+.016,.85,'eye',wing.id,'=');
    }
  }
  // Six tucked flight legs open onto the same authored support on landing.
  for (const side of [-1,1]) for (let leg=0; leg<3; leg++) {
    const y=-.16+leg*.12, grip=clamp01(pose.grip), mix=(a:number,b:number):number=>a+(b-a)*grip;
    const points: Point[] = [[side*.11,y,-.06],
      [side*(.24+leg*.025),mix(y-.19,y-.08),mix(-.08,.025)],
      [side*mix(.29+leg*.025,.16+leg*.055),mix(y-.34,0),mix(-.035,0)]];
    stroke(points[0]!,points[1]!,'leg','legs',5);
    stroke(points[1]!,points[2]!,'leg','legs',5);
  }
  // A compact shield, intentionally flat and bold instead of a shaded ellipsoid.
  disc(0,-.04,.17,.18,.31,'body','thorax','#');
  disc(0,-.39,.18,.26,.15,'body','head','=');
  stroke([-.08,-.25,.19],[-.10,.08,.19],'vein','thorax',8,'=');
  const lookX = state.target ? Math.max(-1,Math.min(1,state.target.x)) : state.staticPose ? .65 : .18;
  const lookY = state.target ? Math.max(-1,Math.min(1,state.target.y)) : -.15;
  // .50 eye-landmark spacing is shared with the perch compositor.
  // Eye domes are exaggerated, but pupils and lids are explicitly cartoon marks.
  const eyes: [Vec3,Vec3] = [transform(-.25,-.56,.20),transform(.25,-.56,.20)];
  for (const side of [-1,1]) {
    const part: DragonflyPart = side<0 ? 'left-eye' : 'right-eye';
    const cx=side*.25,cy=-.56,rx=.235,ry=side>0 ? .24 : .23;
    disc(cx,cy,.205,rx,ry,'eye',part,' ');
    for(let step=0;step<36;step++) {
      const a=step/36*TAU,b=(step+1)/36*TAU;
      stroke([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,.225],
        [cx+Math.cos(b)*rx,cy+Math.sin(b)*ry,.225],'vein',part,1);
    }
    // A very small pupil patch collapses to one stable glyph at phone size.
    disc(cx+lookX*.055,cy+lookY*.055,.255,.035,.045,'eye',part,'@');
    // The leading lid narrows during the load, then opens again for the brake.
    if(load>.02) stroke([cx-rx*.8,cy-ry*.5+load*.06,.26],
      [cx+rx*.8,cy-ry*.5+load*.06,.26],'eye',part,6,'-');
  }
  // Ten linked, tapered plates. The stable slow curve gives the tail a line of
  // action; a tiny periodic flex remains continuous at the wing-clock seam.
  const curve = (u:number):number => .065*u*u + Math.sin(beat+seedOffset*TAU)*.016*u*u;
  for(let segment=0;segment<10;segment++) {
    const start=.20+segment*.145,radius=.122-segment*.0087;
    for(let row=0;row<=4;row++) {
      const u=row/4,y=start+u*.145,collar=row===0||row===4,bulge=.84+.16*Math.sin(u*Math.PI);
      for(let col=-2;col<=2;col++) {
        const x=col/2;
        emit(curve((y-.20)/1.45)+x*radius*bulge,y,.18+.012*(1-x*x),.8,
          collar?'band':'body','abdomen',collar?'=':Math.abs(col)===2?'|':'#');
      }
    }
  }
  const abdomenTip=transform(curve(1),1.65,.18);
  return {samples,wings,eyes,abdomenTip};
}
