const TAU = Math.PI * 2;
const MAX_SAMPLES = 6144;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const FLIGHT = Object.freeze({ pitch: 0, grip: 0 });
/** Original parameterized dragonfly anatomy. No view, rasterizer or clock ownership. */
export function buildDragonflyGeometry(state, config, pose = FLIGHT) {
    const samples = [], wings = [];
    const c = Math.cos(state.heading), s = Math.sin(state.heading), cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
    const transform = (x, y, z) => {
        const py = y * cp - z * sp, pz = y * sp + z * cp;
        return { x: state.position.x + c * x - s * py, y: state.position.y + s * x + c * py, z: pz };
    };
    const emit = (x, y, z, tone, material, part) => {
        if (samples.length >= MAX_SAMPLES)
            throw new RangeError('Dragonfly geometry exceeded its sample budget');
        const point = transform(x, y, z);
        if (![point.x, point.y, point.z, tone].every(Number.isFinite))
            throw new RangeError('Nonfinite dragonfly geometry');
        samples.push({ ...point, tone: clamp01(tone), material, part, stableIndex: samples.length });
    };
    const ellipsoid = (cx, cy, cz, rx, ry, rz, material, part, latitude = 10, longitude = 20) => {
        for (let row = 0; row <= latitude; row++) {
            const polar = row / latitude * Math.PI;
            for (let col = 0; col < longitude; col++) {
                const phi = col / longitude * TAU, ny = Math.cos(polar);
                const nx = Math.sin(polar) * Math.cos(phi), nz = Math.sin(polar) * Math.sin(phi);
                const light = material === 'eye' ? .32 + .56 * Math.max(0, nz) * Math.max(.4, 1 + nx * .35) : .29 + .48 * Math.max(0, nz) + .12 * Math.max(0, -nx);
                emit(cx + nx * rx, cy + ny * ry, cz + nz * rz, light, material, part);
            }
        }
    };
    const beat = config.motion === 'static' ? 0 : state.wingPhase;
    const seedOffset = ((Math.imul(state.seed, 1103515245) + 12345) >>> 0) / 4294967296;
    const wingSpecs = [
        { id: 'left-fore', side: -1, hind: false, offset: .06 },
        { id: 'right-fore', side: 1, hind: false, offset: .22 },
        { id: 'left-hind', side: -1, hind: true, offset: Math.PI + .23 },
        { id: 'right-hind', side: 1, hind: true, offset: Math.PI + .39 },
    ];
    for (const wing of wingSpecs) {
        const rootX = wing.side * .12, rootY = wing.hind ? .045 : -.19, rootZ = -.015;
        const angle = config.motion === 'static' ? (state.staticPose ? .22 : .06) * (wing.hind ? -1 : 1) :
            Math.sin(beat + wing.offset + seedOffset * .45) * config.wingAmplitude;
        const span = wing.hind ? 1.40 : 1.52, sweep = wing.hind ? .55 : -.51;
        const chord = wing.hind ? .235 : .15;
        const pointAt = (u, v) => {
            // Broad hindwing bases and tapered tips, with a deliberate dark channel
            // between fore/hind pairs even in the minimum portrait grid.
            const width = chord * Math.pow(Math.max(0, Math.sin(Math.PI * u)), wing.hind ? .55 : .8) * (wing.hind ? 1 - .3 * u : 1);
            return [rootX + wing.side * span * u * Math.cos(angle),
                rootY + sweep * u + .06 * Math.sin(Math.PI * u) + v * width,
                rootZ + Math.sin(angle) * span * u + .025 * Math.sin(Math.PI * u) * (1 - v * v)];
        };
        const tip = pointAt(1, 0);
        wings.push({ id: wing.id, root: transform(rootX, rootY, rootZ), tip: transform(...tip), angle });
        // Root appears explicitly in each blade's samples; every deformation is relative to it.
        emit(rootX, rootY, rootZ, .64, 'vein', wing.id);
        for (let row = 1; row <= 56; row++) {
            const u = row / 56;
            for (let column = -2; column <= 2; column++) {
                const v = column / 2, point = pointAt(u, v);
                const edge = Math.abs(column) === 2;
                emit(...point, edge ? .58 : .08 + .08 * (1 - v * v), edge ? 'vein' : 'wing', wing.id);
            }
        }
        // A sparse vein lattice; do not replace every transparent cell with a cross.
        for (let row = 1; row <= 56; row++) {
            const point = pointAt(row / 56, -.22);
            emit(point[0], point[1], point[2] + .003, .30, 'vein', wing.id);
        }
        for (let row = 9; row < 49; row += 8)
            for (let column = -2; column <= 2; column++) {
                const point = pointAt(row / 56 + column * .004, column / 2);
                emit(point[0], point[1], point[2] + .004, .25, 'vein', wing.id);
            }
        // Pterostigma: a short opaque mark near the leading tip, not a glowing tip.
        for (let row = 44; row <= 48; row++)
            for (const v of [-.85, -.55]) {
                const point = pointAt(row / 56, v);
                emit(point[0], point[1], point[2] + .008, .6, 'band', wing.id);
            }
    }
    // Flight basket opens before touchdown. Six feet grip the same transverse
    // twig through the thorax origin; the habitat draws that exact support line.
    for (const side of [-1, 1])
        for (let leg = 0; leg < 3; leg++) {
            const y = -.16 + leg * .12;
            const grip = clamp01(pose.grip), mix = (a, b) => a + (b - a) * grip;
            const points = [[side * .11, y, -.06],
                [side * (.24 + leg * .025), mix(y - .19, y - .08), mix(-.08, .025)],
                [side * mix(.29 + leg * .025, .16 + leg * .055), mix(y - .34, 0), mix(-.035, 0)]];
            for (let segment = 0; segment < 2; segment++) {
                const from = points[segment], to = points[segment + 1];
                for (let step = 0; step <= 12; step++) {
                    const u = step / 12;
                    emit(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u, .57, 'leg', 'legs');
                }
            }
        }
    ellipsoid(0, -.04, .025, .18, .31, .14, 'body', 'thorax', 12, 24);
    ellipsoid(0, -.43, .045, .18, .135, .12, 'body', 'head', 8, 20);
    // Leave a medial valley: overlapping eye domes became one bright cap at 72x44.
    const eyes = [transform(-.17, -.51, .12), transform(.17, -.51, .12)];
    ellipsoid(-.17, -.51, .12, .113, .125, .125, 'eye', 'left-eye', 10, 20);
    ellipsoid(.17, -.51, .12, .113, .125, .125, 'eye', 'right-eye', 10, 20);
    // Narrow thoracic stripes follow the rounded shell instead of making a block.
    for (const side of [-1, 1])
        for (let row = 0; row < 19; row++) {
            const y = -.27 + row * .024, x = side * (.065 + .012 * Math.sin(row / 18 * Math.PI));
            const z = .025 + .14 * Math.sqrt(Math.max(0, 1 - (y + .04) ** 2 / .31 ** 2 - x * x / .18 ** 2));
            emit(x, y, z + .004, .35, 'band', 'thorax');
        }
    // Ten connected tapering segments with dark collars, rather than a single tail line.
    // Integer periodicity matters because wingPhase wraps at 2pi. The previous
    // fractional harmonic jumped at every wrap; this smaller curve is continuous.
    const curve = (u) => Math.sin(beat + seedOffset * TAU) * .016 * u * u;
    for (let segment = 0; segment < 10; segment++) {
        const start = .20 + segment * .145, radius = .122 - segment * .0087;
        for (let row = 0; row <= 6; row++) {
            const u = row / 6, y = start + u * .145;
            const collar = row === 0 || row === 6, bulge = .84 + .16 * Math.sin(u * Math.PI);
            for (let col = 0; col < 18; col++) {
                const theta = col / 18 * TAU, nz = Math.sin(theta);
                emit(curve((y - .20) / 1.45) + Math.cos(theta) * radius * bulge, y, .025 + nz * radius * .75, collar ? .29 : .50 + .34 * Math.max(0, nz), collar ? 'band' : 'body', 'abdomen');
            }
        }
    }
    const abdomenTip = transform(curve(1), 1.65, .025);
    return { samples, wings, eyes, abdomenTip };
}
