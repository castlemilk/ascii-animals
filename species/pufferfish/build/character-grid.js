/** Original Reef Curmudgeon art. Pure printable-ASCII composition: no DOM,
 * clock, randomness, raster animal or autonomous work. Public geometry remains
 * available separately; this deliberately sparse drawing is the browser face. */
import { integer } from './model.js';
export const CHARACTER_PALETTE = Object.freeze([
    '#0c171d', '#edb663', '#f7e8c7', '#78b6aa', '#ee927c', '#38565a', '#b58146',
]);
/** Shapes use this small vocabulary. Optional actor labels add printable text. */
export const CHARACTER_MARKS = " .,:;'_-=~^/\\|()<>oO@!*+";
export function createCharacterGrid(cols, rows) {
    integer(cols, 1, 160, 'character columns');
    integer(rows, 1, 90, 'character rows');
    return { cols, rows, cells: new Uint8Array(cols * rows).fill(32),
        colors: new Uint8Array(cols * rows), owners: new Int16Array(cols * rows).fill(-1), samples: 0 };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
/** Drawing is observational. Repeated draw order cannot change a later frame. */
export function composePufferfishFrame(grid, state, options) {
    grid.cells.fill(32);
    grid.colors.fill(0);
    grid.owners.fill(-1);
    grid.samples = 0;
    const { width, height, view, staticPose } = options;
    const cellW = Math.max(width / grid.cols, height / (90 * 1.35)), cellH = cellW * 1.35;
    const scene = state.version === 'pufferfish-director-v1' ? state : null;
    const solo = scene ? scene.actors[scene.selected].state : state;
    const time = staticPose ? 0 : (scene?.tick ?? solo.tick);
    function cell(col, row, glyph, color, owner = -1) {
        if (++grid.samples > 16000)
            throw new RangeError('Pufferfish character submission budget exceeded');
        // One empty cell of padding makes smallest-size clipping observable in tests.
        if (col < 1 || row < 1 || col >= grid.cols - 1 || row >= grid.rows - 1)
            return;
        const i = row * grid.cols + col;
        grid.cells[i] = glyph.charCodeAt(0);
        grid.colors[i] = color;
        grid.owners[i] = glyph === ' ' ? -1 : owner;
    }
    function mark(x, y, glyph, color, owner = -1) {
        cell(Math.round(x / cellW - .5), Math.round(y / cellH - .5), glyph, color, owner);
    }
    function line(a, b, color, owner = -1, glyph) {
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const stroke = glyph ?? (Math.abs(dy) < Math.abs(dx) * .35 ? '-' : Math.abs(dx) < Math.abs(dy) * .35 ? '|' : dx * dy > 0 ? '\\' : '/');
        // One cell per major-axis step. Dense curve samples create doubled,
        // hairy diagonals at small sizes; this is a deliberate ASCII staircase.
        let x = Math.round(a[0] / cellW - .5), y = Math.round(a[1] / cellH - .5);
        const endX = Math.round(b[0] / cellW - .5), endY = Math.round(b[1] / cellH - .5);
        const width = Math.abs(endX - x), height = Math.abs(endY - y);
        const stepX = x < endX ? 1 : -1, stepY = y < endY ? 1 : -1;
        let error = width - height;
        for (;;) {
            cell(x, y, stroke, color, owner);
            if (x === endX && y === endY)
                break;
            const twice = error * 2;
            if (twice > -height) {
                error -= height;
                x += stepX;
            }
            if (twice < width) {
                error += width;
                y += stepY;
            }
        }
    }
    function text(x, y, value, color) {
        const clean = value.replace(/[^\x20-\x7e]/g, '?');
        const col = Math.round(x / cellW - clean.length / 2), row = Math.round(y / cellH - .5);
        for (let i = 0; i < clean.length; i++)
            cell(col + i, row, clean[i], color);
    }
    // A few graphic habitat accents, with clear water around the face. These are
    // ordinary unowned ASCII cells, never independent particles or hit targets.
    const flow = scene?.flow ?? .08;
    for (let stem = 0; stem < 3; stem++) {
        const rootX = width * (.095 + stem * .025), rootY = height * .87;
        const length = height * [.105, .155, .085][stem];
        const bend = width * (.012 * Math.sin(time / 115 + stem * .7) + flow * .018);
        let previous = [rootX, rootY];
        for (let part = 1; part <= 4; part++) {
            const u = part / 4;
            const next = [rootX + Math.sin(u * 4 + stem * .6) * width * .008 + bend * u * u, rootY - length * u];
            line(previous, next, part === 4 ? 3 : 5);
            previous = next;
        }
    }
    const coralX = width * .88, coralY = height * .86;
    line([coralX, coralY], [coralX - width * .01, coralY - height * .085], 5);
    line([coralX - width * .005, coralY - height * .04], [coralX - width * .045, coralY - height * .07], 4);
    line([coralX - width * .005, coralY - height * .04], [coralX + width * .033, coralY - height * .085], 4);
    mark(width * .16, height * .885, '.', 5);
    mark(width * .2, height * .88, '_', 5);
    mark(width * .83, height * .88, '_', 5);
    mark(width * .92, height * .89, '.', 5);
    mark(width * .17, height * .20, 'o', 3);
    mark(width * .145, height * .275, '.', 5);
    mark(width * .84, height * .23, 'o', 5);
    // Invitation indicator lives at the actual requested point. It fades by
    // simplifying its marks, not by moving the target or inventing an outcome.
    if (scene?.invitation) {
        const invitation = scene.invitation;
        const x = (invitation.x + 1) * width / 2, y = (invitation.y + 1) * height / 2;
        mark(x, y, 'o', 4);
        if (invitation.until - scene.tick > 48) {
            mark(x - cellW * 2, y, '.', 4);
            mark(x + cellW * 2, y, '.', 4);
            mark(x, y - cellH * 1.5, "'", 4);
        }
    }
    function fish(fishState, actor) {
        const t = staticPose ? 0 : fishState.tick;
        const phase = fishState.phase, inflated = fishState.inflation;
        const puff = inflated * (fishState.config.inflationScale - 1) / .65;
        const notice = phase.kind === 'approach' ? smooth(phase.age / fishState.config.dwellTicks)
            : phase.kind === 'inflating' && phase.stage === 'belly' ? 1 - smooth(phase.age / Math.min(16, fishState.config.bellyTicks)) : 0;
        const recovery = phase.kind === 'recovering' ? phase.age / fishState.config.recoveryTicks : 0;
        const sigh = phase.kind === 'recovering' ? Math.sin(Math.PI * recovery) ** 2 : 0;
        const bob = staticPose ? 0 : Math.sin(t / 75 + fishState.variation) * .025 * (1 - inflated * .65);
        const scale = Math.min(width / 5.2, height / 4.5) * (actor ? actor.scale * options.sceneScale : 1);
        const cx = width * ((actor?.x ?? 0) + 1) / 2;
        const cy = height * ((actor?.y ?? 0) + 1) / 2 + (bob + notice * .045 + sigh * .045) * scale;
        const rx = (1.08 + puff * .25) * (1 + notice * .055);
        const ry = (.63 + puff * .64) * (1 - notice * .14);
        const facing = view === 'front' ? 0 : view === 'right' ? -1 : 1;
        const gaze = actor?.gaze ?? { x: fishState.pointer.active ? fishState.pointer.x : 0, y: fishState.pointer.active ? fishState.pointer.y : 0 };
        const lookX = clamp(gaze.x, -1, 1), lookY = clamp(gaze.y, -1, 1);
        const invitationAge = scene?.invitation && actor && scene.invitation.id === actor.id
            ? 360 - (scene.invitation.until - scene.tick) : -1;
        const inspect = invitationAge >= 0 ? smooth(invitationAge / 30) * (1 - smooth((invitationAge - 300) / 60)) : 0;
        const roll = staticPose ? 0 : (Math.sin(t / 84 + fishState.variation) * .018 * (1 - inflated)
            + lookX * inspect * .055 + Math.sin(recovery * Math.PI * 4) * sigh * .035) * fishState.config.wobble;
        const cr = Math.cos(roll), sr = Math.sin(roll), owner = actor?.id ?? 0;
        const pt = (x, y) => [cx + (x * cr - y * sr) * scale, cy + (x * sr + y * cr) * scale];
        const ink = (x, y, glyph, color = 1) => { const p = pt(x, y); mark(p[0], p[1], glyph, color, owner); };
        const stroke = (x1, y1, x2, y2, color = 1, glyph) => line(pt(x1, y1), pt(x2, y2), color, owner, glyph);
        function arc(x, y, rX, rY, color = 1, start = 0, end = Math.PI * 2) {
            const steps = Math.max(2, Math.ceil(Math.abs(end - start) / (Math.PI / 4)));
            for (let i = 0; i < steps; i++) {
                const a = start + (end - start) * i / steps, b = start + (end - start) * (i + 1) / steps;
                const middle = (a + b) / 2;
                const glyph = Math.abs(Math.sin(middle)) > .80 ? '_'
                    : Math.abs(Math.cos(middle)) > .80 ? Math.cos(middle) < 0 ? '(' : ')' : undefined;
                stroke(x + rX * Math.cos(a), y + rY * Math.sin(a), x + rX * Math.cos(b), y + rY * Math.sin(b), color, glyph);
            }
        }
        // Tail and far paddles are drawn first, so their roots are hidden by the
        // body mask and reconnect exactly to its current contour every frame.
        const tailSide = facing === 0 ? 1 : -facing;
        const tailWag = staticPose ? 0 : Math.sin(t / 10 + fishState.variation) * .055 * (1 - inflated * .5);
        const tailRoot = tailSide * rx * .90, tailTip = tailSide * (rx + .43 - inflated * .08);
        const tailY = -.20 + tailWag;
        stroke(tailRoot, -.12, tailTip, tailY - .20, 3);
        stroke(tailTip, tailY - .20, tailTip, tailY + .18, 3);
        stroke(tailTip, tailY + .18, tailRoot, -.05, 3);
        stroke(tailRoot, -.09, tailTip, tailY, 3, '-');
        // Clear only the body interior. Transparent cells remain unselectable;
        // there is no hidden bounding-box selection target or raster body fill.
        const bound = (Math.max(rx, ry) + .1) * scale;
        const minCol = Math.max(1, Math.floor((cx - bound) / cellW)), maxCol = Math.min(grid.cols - 2, Math.ceil((cx + bound) / cellW));
        const minRow = Math.max(1, Math.floor((cy - bound) / cellH)), maxRow = Math.min(grid.rows - 2, Math.ceil((cy + bound) / cellH));
        for (let row = minRow; row <= maxRow; row++)
            for (let col = minCol; col <= maxCol; col++) {
                const xx = ((col + .5) * cellW - cx) / scale, yy = ((row + .5) * cellH - cy) / scale;
                const x = xx * cr + yy * sr, y = -xx * sr + yy * cr;
                if ((x / rx) ** 2 + (y / ry) ** 2 < .94)
                    cell(col, row, ' ', 0);
            }
        // Twelve authored corners make a confident bean/balloon outline at every
        // grid density. A single pale belly boundary carries volume, without bands.
        const contour = [[-.44, -1], [.44, -1], [.78, -.78], [1, -.34],
            [1, .30], [.80, .75], [.45, 1], [-.45, 1], [-.80, .75], [-1, .30], [-1, -.34], [-.78, -.78]];
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i], b = contour[(i + 1) % contour.length];
            stroke(a[0] * rx, a[1] * ry, b[0] * rx, b[1] * ry, 1, a[1] === b[1] ? '_' : undefined);
        }
        stroke(-rx * .58, ry * .48, -rx * .40, ry * .68, 2);
        stroke(-rx * .40, ry * .68, rx * .40, ry * .68, 2, '_');
        stroke(rx * .40, ry * .68, rx * .58, ry * .48, 2);
        // Sparse short spines unfold after the belly. At rest three tiny nubs hint
        // at the species without turning the silhouette into a hairy texture.
        const spineLift = smooth((inflated - .33) / .67);
        const spineAngles = [-2.65, -2.20, -1.76, -1.30, -.86, -.42, .45, .95, 1.57, 2.2, 2.68];
        for (const [i, a] of spineAngles.entries()) {
            if (spineLift < .02 && ![1, 3, 4].includes(i))
                continue;
            const length = .035 + spineLift * .20;
            const x = Math.cos(a), y = Math.sin(a);
            // Attach each ray to the authored polygon, not to an invisible ellipse.
            let edge = 1;
            for (let n = 0; n < contour.length; n++) {
                const p = contour[n], q = contour[(n + 1) % contour.length];
                const ex = q[0] - p[0], ey = q[1] - p[1], cross = x * ey - y * ex;
                if (Math.abs(cross) < .0001)
                    continue;
                const distance = (p[0] * ey - p[1] * ex) / cross;
                const along = (p[0] * y - p[1] * x) / cross;
                if (distance >= 0 && along >= 0 && along <= 1)
                    edge = Math.min(edge, distance);
            }
            stroke(x * rx * edge, y * ry * edge, x * (rx * edge + length), y * (ry * edge + length), 1);
        }
        // Attached paddle fins have independent phases and a lower amplitude while
        // puffed. Their extra effort reflects the director's actual travel intent.
        for (const side of [-1, 1]) {
            const finWave = staticPose ? 0 : Math.sin(t / (side < 0 ? 8.2 : 9.3) + fishState.variation + side * 1.1);
            const finReach = .22 + (actor?.finEffort ?? .2) * .09 + finWave * .035;
            const rootX = side * rx * .94, tipX = side * (rx + finReach);
            const rootY = ry * .35, tipY = rootY + .10 + finWave * .06 + sigh * .09;
            stroke(rootX, rootY - .07, tipX, tipY - .06, 3);
            stroke(tipX, tipY - .06, tipX + side * .035, tipY + .08, 3, side < 0 ? '(' : ')');
            stroke(tipX + side * .035, tipY + .08, rootX, rootY + .10, 3);
        }
        const faceX = facing * .10 + lookX * inspect * .04;
        const faceY = -ry * .21 + notice * .05;
        const surprise = smooth(inflated / .48);
        const squeezed = notice > .66;
        const sleepy = phase.kind === 'recovering' ? smooth(recovery / .22) * (1 - smooth((recovery - .72) / .28)) : 0;
        const eyeSpacing = .365 + surprise * .025;
        for (const side of [-1, 1]) {
            const ex = faceX + side * eyeSpacing;
            const erx = .245 * (view !== 'front' && side === -facing ? .89 : 1);
            const curious = inspect * (side * lookX > .1 ? 1 : .12);
            const openness = Math.max(surprise, curious * .72);
            const ery = .20 + openness * .12;
            if (squeezed) {
                ink(ex, faceY, side < 0 ? '>' : '<', 2);
                continue;
            }
            if (sleepy > .65) {
                arc(ex, faceY + .12, erx, .115, 2, Math.PI, Math.PI * 2);
            }
            else {
                // Calm eyes expose only the lower socket beneath a heavy lid. The
                // inspection raises just the leading eye; a puff opens both fully.
                arc(ex, faceY, erx, ery, 2, openness > .6 ? 0 : -.05, openness > .6 ? Math.PI * 2 : Math.PI + .05);
                if (openness < .6) {
                    const browY = faceY - .055;
                    stroke(ex - erx - .015, browY + side * .055, ex + erx + .015, browY - side * .055, 1, '=');
                }
                else {
                    // A single lifted brow, not another little oval above the eye.
                    stroke(ex - erx * .75, faceY - ery - .10, ex + erx * .75, faceY - ery - .10 - side * .045, 1, '-');
                }
                // Keep each pupil above the discrete lid at the smallest grid. An
                // inward gaze must not disappear behind a quantized diagonal brow.
                ink(ex + lookX * .075, faceY + lookY * .05 + (1 - surprise) * .07, surprise > .5 ? 'O' : 'o', 2);
            }
        }
        // Freckles are authored landmarks, not pseudorandom per-frame texture.
        for (const side of [-1, 1]) {
            ink(faceX + side * .74, ry * .19, ':', 6);
            if (scale > 32)
                ink(faceX + side * .82, ry * .28, '.', 6);
        }
        const mouthX = faceX + sigh * .12, mouthY = faceY + .37 + surprise * .06;
        if (squeezed)
            stroke(mouthX - .09, mouthY, mouthX + .09, mouthY, 4, '-');
        else if (surprise > .38 || sigh > .25)
            ink(mouthX, mouthY, 'o', 4);
        else {
            stroke(mouthX - .095, mouthY + .035, mouthX, mouthY - .025, 2);
            stroke(mouthX, mouthY - .025, mouthX + .095, mouthY + .035, 2);
        }
        // Sigh bubbles emerge from the actual mouth, run once during recovery and
        // have no persistent queue. The two pauses come from the unchanged model.
        if (!staticPose && phase.kind === 'recovering') {
            for (let bubble = 0; bubble < 2; bubble++) {
                const age = recovery - bubble * .24;
                if (age < .05 || age > .58)
                    continue;
                const k = (age - .05) / .53;
                ink(mouthX + .14 + k * .8, mouthY - k * .28, k < .3 ? '.' : 'o', 4);
            }
        }
        if (!staticPose && phase.kind === 'approach' && notice > .28 && notice < .78) {
            ink(faceX + .34, -ry - .23, '!', 4);
        }
        if (actor && scene?.config.labels) {
            const labelY = Math.min(height - cellH * 2, cy + (ry + .34) * scale + cellH);
            text(cx, labelY, `${scene.selected === actor.id ? '> ' : ''}${actor.name}`, scene.selected === actor.id ? 2 : 3);
        }
    }
    if (scene) {
        // Lower figures occlude upper figures; ties are stable by actor ID. A
        // repeated draw therefore has the same visible owner for every cell.
        const actors = [...scene.actors].sort((a, b) => a.y - b.y || a.id - b.id);
        for (const actor of actors)
            fish(actor.state, actor);
    }
    else
        fish(solo);
}
