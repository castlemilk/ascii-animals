/** Private opt-in Reef Curmudgeon cell painter. It owns no clock or input. */
import { finite, record } from './model.js';
import { posePufferfish } from './geometry.js';
import { CHARACTER_PALETTE, composePufferfishFrame, createCharacterGrid } from './character-grid.js';
import { resolveRenderOptions } from './legacy-painter.js';
function validateScene(scene) {
    if (!scene || scene.version !== 'pufferfish-director-v1' || !Array.isArray(scene.actors)
        || scene.actors.length < 1 || scene.actors.length > 3)
        throw new TypeError('Expected a director with 1..3 actors');
    if (!Number.isSafeInteger(scene.tick) || scene.tick < 0 || !Number.isFinite(scene.sceneTick))
        throw new RangeError('Invalid director clock');
    if (!scene.config || typeof scene.config.labels !== 'boolean' || scene.config.count !== scene.actors.length)
        throw new TypeError('Director count/labels must match its actors');
    finite(scene.flow, -1, 1, 'flow');
    if (!Number.isInteger(scene.selected) || scene.selected < 0 || scene.selected >= scene.actors.length)
        throw new RangeError('Invalid selected actor');
    for (const [index, actor] of scene.actors.entries()) {
        if (!actor || actor.id !== index)
            throw new RangeError('Director actor IDs must be dense and ordered');
        finite(actor.x, -1, 1, 'actor x');
        finite(actor.y, -1, 1, 'actor y');
        finite(actor.scale, 0.15, 1.5, 'actor scale');
        finite(actor.yaw, -Math.PI, Math.PI, 'actor yaw');
        finite(actor.finEffort, 0, 1, 'finEffort');
        record(actor.gaze, ['x', 'y'], 'actor gaze');
        finite(actor.gaze.x, -1, 1, 'gaze x');
        finite(actor.gaze.y, -1, 1, 'gaze y');
        if (typeof actor.name !== 'string' || actor.name.length < 1 || actor.name.length > 32
            || !['explorer', 'sentinel', 'drifter'].includes(actor.role))
            throw new TypeError('Invalid actor label');
        posePufferfish(actor.state, true);
    }
}
export function createPufferfishCharacterPainter(canvas, options = {}, makeCanvas = () => canvas.ownerDocument.createElement('canvas')) {
    let config = resolveRenderOptions(options);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx)
        throw new Error('Canvas 2D unavailable; the text description remains available.');
    const atlas = makeCanvas(), atlasCtx = atlas.getContext('2d');
    if (!atlasCtx) {
        atlas.width = atlas.height = 1;
        throw new Error('Glyph atlas Canvas 2D unavailable.');
    }
    let grid = null;
    let width = 0, height = 0, dpr = 1, cellW = 1, cellH = 1.35;
    let rawWidth = 0, rawHeight = 0, rawDpr = 1;
    let tileW = 1, tileH = 1;
    let actorCount = 1, sceneScale = 1, glyphCount = 0, hasFrame = false, disposed = false;
    const firstGlyph = 33, glyphCountInAtlas = 94;
    const neutral = '#f7e8c7';
    function alive() { if (disposed)
        throw new Error('Pufferfish painter is disposed'); }
    function makeAtlas() {
        tileW = Math.ceil(cellW * dpr) + 4;
        tileH = Math.ceil(cellH * dpr) + 4;
        atlas.width = tileW * glyphCountInAtlas;
        atlas.height = tileH * CHARACTER_PALETTE.length;
        atlasCtx.clearRect(0, 0, atlas.width, atlas.height);
        atlasCtx.font = `600 ${(cellW * 1.43 * dpr).toFixed(3)}px ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace`;
        atlasCtx.textAlign = 'center';
        atlasCtx.textBaseline = 'middle';
        for (let color = 0; color < CHARACTER_PALETTE.length; color++) {
            atlasCtx.fillStyle = config.monochrome ? neutral : CHARACTER_PALETTE[color];
            for (let glyph = 0; glyph < glyphCountInAtlas; glyph++) {
                atlasCtx.fillText(String.fromCharCode(firstGlyph + glyph), (glyph + .5) * tileW, (color + .5) * tileH);
            }
        }
    }
    function renderCells() {
        const frame = grid;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#0c171d';
        ctx.fillRect(0, 0, width, height);
        glyphCount = 0;
        const spriteW = tileW / dpr, spriteH = tileH / dpr;
        const pointSize = Math.max(.7, Math.min(2.4, cellW * .30));
        for (let row = 0; row < frame.rows; row++)
            for (let col = 0; col < frame.cols; col++) {
                const i = row * frame.cols + col, code = frame.cells[i];
                if (code === 32)
                    continue;
                if (code < firstGlyph || code > 126)
                    throw new RangeError('Pufferfish frame must contain printable ASCII');
                const color = frame.colors[i];
                if (color >= CHARACTER_PALETTE.length)
                    throw new RangeError('Invalid pufferfish cell color');
                glyphCount++;
                const x = (col + .5) * cellW, y = (row + .5) * cellH;
                if (config.mode === 'points') {
                    ctx.fillStyle = config.monochrome ? neutral : CHARACTER_PALETTE[color];
                    ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
                }
                else {
                    ctx.drawImage(atlas, (code - firstGlyph) * tileW, color * tileH, tileW, tileH, x - spriteW / 2, y - spriteH / 2, spriteW, spriteH);
                }
            }
    }
    function compose(state, still) {
        const frame = grid;
        frame.cells.fill(32);
        frame.colors.fill(0);
        frame.owners.fill(-1);
        frame.samples = 0;
        composePufferfishFrame(frame, state, { width, height, view: config.view, staticPose: still, sceneScale });
        if (!Number.isSafeInteger(frame.samples) || frame.samples < 0 || frame.samples > 16000)
            throw new RangeError('Pufferfish scene sample cap exceeded');
        renderCells();
        const lines = [];
        for (let row = 0; row < frame.rows; row++) {
            lines.push(String.fromCharCode(...frame.cells.subarray(row * frame.cols, (row + 1) * frame.cols)));
        }
        hasFrame = true;
        return Object.freeze({ cols: frame.cols, rows: frame.rows, glyphs: glyphCount, samples: frame.samples,
            width, height, dpr, text: lines.join('\n'), actorCount, sceneScale });
    }
    const painter = {
        resize(nextWidth, nextHeight, nextDpr) {
            alive();
            finite(nextWidth, 0, 100000, 'width');
            finite(nextHeight, 0, 100000, 'height');
            finite(nextDpr, .1, 10, 'DPR');
            rawWidth = nextWidth;
            rawHeight = nextHeight;
            rawDpr = nextDpr;
            hasFrame = false;
            if (nextWidth === 0 || nextHeight === 0) {
                width = height = 0;
                grid = null;
                canvas.width = canvas.height = atlas.width = atlas.height = 1;
                return false;
            }
            const factor = Math.min(1, 1200 / nextWidth, 675 / nextHeight);
            width = nextWidth * factor;
            height = nextHeight * factor;
            dpr = Math.min(config.maxDpr, nextDpr);
            // Retain the declared grid policy: small is exactly 72 columns at 360x270;
            // all other presets have smooth density ceilings and at most 90 rows.
            const densityMix = Math.max(0, Math.min(1, (width - 520) / 180));
            const qualityCols = { small: 72, standard: 120, fine: 160 }[config.quality];
            const targetCols = config.quality === 'small' ? 72 : 96 + (qualityCols - 96) * densityMix;
            cellW = Math.max(width / targetCols, height / (90 * 1.35));
            cellH = cellW * 1.35;
            const cols = Math.min(160, Math.ceil(width / cellW)), rows = Math.min(90, Math.ceil(height / cellH));
            grid = createCharacterGrid(cols, rows);
            canvas.width = Math.max(1, Math.round(width * dpr));
            canvas.height = Math.max(1, Math.round(height * dpr));
            makeAtlas();
            return true;
        },
        configure(patch) {
            alive();
            record(patch, ['view', 'quality', 'monochrome', 'maxDpr', 'mode'], 'render patch');
            const next = resolveRenderOptions({ ...config, ...patch });
            config = next;
            if (rawWidth && rawHeight)
                painter.resize(rawWidth, rawHeight, rawDpr);
        },
        draw(state, still = false) {
            alive();
            if (!grid || !width || !height)
                throw new Error('Cannot draw a zero-size pufferfish surface');
            if (typeof still !== 'boolean')
                throw new TypeError('staticPose must be boolean');
            posePufferfish(state, still);
            actorCount = 1;
            sceneScale = 1;
            return compose(state, still);
        },
        drawScene(scene, still = false) {
            alive();
            if (!grid || !width || !height)
                throw new Error('Cannot draw a zero-size pufferfish surface');
            if (typeof still !== 'boolean')
                throw new TypeError('staticPose must be boolean');
            validateScene(scene);
            actorCount = scene.actors.length;
            const widthMix = Math.max(0, Math.min(1, (width - 520) / 180));
            sceneScale = actorCount === 3 ? .72 + .28 * widthMix * widthMix * (3 - 2 * widthMix) : 1;
            return compose(scene, still);
        },
        hitActor(x, y) {
            alive();
            finite(x, -1, 1, 'hit x');
            finite(y, -1, 1, 'hit y');
            if (!hasFrame || !grid || !width || !height)
                return null;
            const col = Math.min(grid.cols - 1, Math.floor((x + 1) * width / (2 * cellW)));
            const row = Math.min(grid.rows - 1, Math.floor((y + 1) * height / (2 * cellH)));
            const i = row * grid.cols + col, owner = grid.owners[i];
            return grid.cells[i] !== 32 && owner !== undefined && owner >= 0 && owner < actorCount ? owner : null;
        },
        getConfig: () => config,
        dispose() {
            if (disposed)
                return;
            disposed = true;
            hasFrame = false;
            grid = null;
            canvas.width = canvas.height = atlas.width = atlas.height = 1;
        },
    };
    return painter;
}
