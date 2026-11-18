import { createGeckoArtwork as mountGecko } from '../../public/gecko.js';
import { createGecko } from './gecko.js';
import { renderGeckoGrid } from './preview.js';
/** The page uses the same typed controller as a library consumer. No window singleton. */
export let geckoDemo = null;
const CAST = ['mica', 'pip', 'slate'];
const ROLE_DEFAULTS = ['scout', 'hunter', 'sentry'];
const INITIAL_DIRECTOR = {
    scene: 'moonlit-wall', population: 3, tempo: 1, boldness: .55,
    reverse: false, showRoutes: false, autonomy: true, roles: ROLE_DEFAULTS
};
const SCENES = {
    'moonlit-wall': { title: 'The moonlit wall', invitation: 'A quiet wall. Let each visitor find a way through it.' },
    'lantern-hunt': { title: 'A moth by the lantern', invitation: 'A little light has caught their attention.' },
    'passing-shadow': { title: 'A passing shadow', invitation: 'Watch a surprise become a small act of courage.' }
};
const BEATS = {
    emerge: 'A few careful arrivals', climb: 'Following the seams', inspect: 'Something worth a closer look',
    traverse: 'There is more wall to explore', perch: 'A place to watch the night', notice: 'A small light catches the eye',
    stalk: 'One quiet step at a time', poise: 'Waiting for just the right moment', strike: 'A brief flash of courage',
    return: 'Finding familiar ground', peek: 'Is the coast clear?', explore: 'Curiosity takes the first step',
    shadow: 'A shadow crosses the wall', shelter: 'A quieter corner, for a moment', settle: 'The wall feels safe again'
};
const MOTIVES = {
    explore: { short: 'Finding a new foothold', detail: 'There is another seam to follow, and another corner to investigate.' },
    inspect: { short: 'Following an invitation', detail: 'Something nearby deserves a careful, closer look.' },
    stalk: { short: 'Keeping the moth in sight', detail: 'A little movement by the light is too interesting to ignore.' },
    poise: { short: 'Waiting for the moment', detail: 'The feet settle. The head holds. A little patience before a quick reach.' },
    strike: { short: 'Reaching toward the light', detail: 'A brief, deliberate reach toward the moth, then back to careful steps.' },
    shelter: { short: 'Finding a quieter corner', detail: 'A shadow is reason enough to seek a little shelter.' },
    return: { short: 'Finding familiar ground', detail: 'The wall has a few favourite places. This is the way back to one of them.' },
    watch: { short: 'Keeping a quiet watch', detail: 'There is plenty to notice without rushing anywhere.' },
    yield: { short: 'Making room for a neighbour', detail: 'A neighbour is close. A small pause leaves room for both sets of feet.' },
    retreat: { short: 'Taking a few steps back', detail: 'A continuous curled tail and a short retreat. Curiosity will return in its own time.' }
};
const titles = {
    idle: 'Resting', approach: 'Curious', startle: 'A little startled', retreat: 'Stepping back', recover: 'Finding courage', cooldown: 'Taking a moment'
};
const demoDocument = document;
const demoWindow = window;
function element(id) {
    const node = demoDocument.getElementById(id);
    if (!node)
        throw new Error(`Missing gecko demo element: ${id}`);
    return node;
}
function optional(id) { return demoDocument.getElementById(id); }
function text(id, value) {
    const node = optional(id);
    if (node && node.textContent !== value)
        node.textContent = value;
}
function words(value) { return value.replace(/[-_]/g, ' '); }
function sentence(value) {
    const readable = words(value);
    return readable.charAt(0).toUpperCase() + readable.slice(1);
}
function selected(state) {
    return state.individuals.find(visitor => visitor.id === state.selectedId) ?? state.individuals[0];
}
function isBusy(kind, cooldown = 0) {
    return cooldown > 0 || kind === 'startle' || kind === 'retreat' || kind === 'recover' || kind === 'cooldown';
}
const canvas = element('gecko');
const phase = element('phase');
const pause = element('pause');
const startle = element('startle');
const help = element('scene-help');
const feedback = element('action-status');
const fallback = element('fallback');
const fallbackMessage = element('fallback-message');
const frame = element('text-frame');
// The minimal original host remains a supported page fixture and consumer example.
const hasDirectorUI = optional('director') !== null;
const listeners = [];
let demoDisposed = false;
function listen(target, event, handler) {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
}
function listenOptional(id, event, handler) {
    const target = optional(id);
    if (target)
        listen(target, event, handler);
}
function announce(message) { feedback.textContent = message; }
function reportFailure(error, action) {
    announce(`That ${action} could not be completed.`);
    console.warn(`Gecko ${action} failed`, error);
}
function refreshDirector(state, status) {
    const visitor = selected(state);
    const still = status.paused || status.reducedMotion;
    const kind = visitor?.body.behavior.kind ?? status.phase;
    const busy = !still && isBusy(kind, visitor?.cooldown ?? 0);
    const visitorName = visitor?.label ?? 'The gecko';
    text('scene-title', SCENES[state.arc.scene].title.toUpperCase());
    text('scene-beat', still ? 'A quiet moment on the wall' : BEATS[state.arc.beat]);
    text('cycle-label', `NIGHT ${String(state.arc.cycle + 1).padStart(2, '0')} · BEAT ${String(state.arc.beatIndex + 1).padStart(2, '0')}`);
    text('cast-count', String(state.individuals.length).padStart(2, '0'));
    const progress = optional('scene-progress');
    if (progress)
        progress.value = Math.max(0, Math.min(1, state.arc.progress));
    for (const scene of Object.keys(SCENES)) {
        optional(`scene-${scene}`)?.setAttribute('aria-pressed', String(state.options.scene === scene));
    }
    for (const id of CAST) {
        const animal = state.individuals.find(item => item.id === id);
        const card = optional(`cast-${id}`);
        if (card) {
            card.hidden = !animal;
            card.dataset.selected = String(state.selectedId === id);
        }
        optional(`select-${id}`)?.setAttribute('aria-pressed', String(state.selectedId === id));
        if (animal) {
            text(`motive-${id}`, MOTIVES[animal.motive].short);
            const role = optional(`role-${id}`);
            if (role && role.value !== animal.role)
                role.value = animal.role;
        }
    }
    text('selected-name', visitorName);
    text('selected-emotion', still ? 'Still & watchful' : sentence(visitor?.emotion ?? kind));
    text('selected-motive', visitor ? MOTIVES[visitor.motive].detail : 'Choose a visitor to follow its story.');
    startle.disabled = busy;
    startle.textContent = busy ? 'Taking a moment' : 'Cast a shadow';
    text('cooldown-note', still
        ? 'Choose an encounter to compose a still scene. Nothing moves until motion is enabled.'
        : busy ? `${visitorName} is recovering. Another shadow can wait.`
            : `A shadow starts with ${visitorName}; nearby neighbours may notice.`);
    help.textContent = status.reducedMotion
        ? 'Reduced motion: encounters select still scenes. Guide controls do not animate the wall.'
        : status.paused ? 'A quiet moment. Choose a still encounter, or press Play to continue.'
            : busy ? `${visitorName} is ${words(titles[kind]).toLowerCase()}. Give those careful feet a moment.`
                : `Follow ${visitorName}: move nearby or tap the wall. Offer a moth for a new distraction.`;
    phase.textContent = status.reducedMotion ? 'Still scene' : status.paused ? 'Paused' : `${visitorName} · ${titles[kind]}`;
    const values = [['population', state.options.population], ['tempo', state.options.tempo], ['boldness', state.options.boldness]];
    for (const [id, value] of values) {
        const input = optional(id);
        if (input && Number(input.value) !== value)
            input.value = String(value);
    }
    text('population-value', String(state.options.population));
    text('tempo-value', `${state.options.tempo.toFixed(1)}×`);
    text('boldness-value', `${Math.round(state.options.boldness * 100)}%`);
    for (const [id, value] of [['autonomy', state.options.autonomy], ['show-routes', state.options.showRoutes], ['reverse', state.options.reverse]]) {
        const input = optional(id);
        if (input)
            input.checked = value;
    }
    canvas.setAttribute('aria-label', `${state.individuals.length} ASCII gecko${state.individuals.length === 1 ? '' : 's'} in the scene ${SCENES[state.arc.scene].title}. ${visitorName} is selected. Each has a broad head, four splayed pad-toed feet, and a long attached tail. Move the pointer or tap to guide. Arrow keys guide and Space pauses when the wall is focused.`);
}
function refresh(status) {
    phase.textContent = status.reducedMotion ? 'Still portrait' : status.paused ? 'Paused' : titles[status.phase];
    pause.textContent = status.paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-pressed', String(status.paused));
    pause.setAttribute('aria-label', status.paused ? 'Play gecko animation' : 'Pause gecko animation');
    const busy = !status.paused && !status.reducedMotion && isBusy(status.phase);
    startle.disabled = busy;
    if (!hasDirectorUI)
        startle.textContent = busy ? 'Taking a moment' : 'Startle gecko';
    help.textContent = status.reducedMotion
        ? 'Reduced motion: Startle selects a still pose.'
        : status.paused ? 'A quiet moment. Play when you are ready.'
            : busy ? 'Let the gecko recover before another surprise.' : 'Move gently to invite a few steps.';
    fallback.hidden = !(status.tooSmall || status.zeroSize);
    if (status.tooSmall)
        fallbackMessage.textContent = `This gecko needs ${hasDirectorUI ? 320 : 360} pixels of space. Its plain-text portrait is still available below.`;
    const director = hasDirectorUI ? geckoDemo?.getDirectorSnapshot() : null;
    if (director)
        refreshDirector(director, status);
}
function refreshText() {
    if (geckoDemo && !demoDisposed)
        frame.textContent = geckoDemo.exportText();
    else {
        const poster = createGecko();
        try {
            frame.textContent = renderGeckoGrid(poster.getSnapshot(), { cols: 112, rows: 50 }).text;
        }
        finally {
            poster.dispose();
        }
    }
}
function reflect() { if (geckoDemo && !demoDisposed)
    refresh(geckoDemo.getStatus()); }
function configure(patch, message) {
    if (!geckoDemo || demoDisposed)
        return;
    try {
        geckoDemo.configureDirector(patch);
        reflect();
        if (message)
            announce(message);
    }
    catch (error) {
        reportFailure(error, 'change');
    }
}
function reportAction(result, type) {
    if (!result)
        return;
    if (result.outcome === 'ignored') {
        announce(result.reason === 'busy'
            ? 'A little more time. This visitor is still finding its courage.'
            : 'The scene is resting. Play to invite movement when motion is enabled.');
    }
    else if (result.outcome === 'static') {
        const still = {
            moth: 'A still scene with a moth to watch.', shadow: 'A still surprise, with one continuous curled tail.',
            return: 'A still scene on familiar ground.', inspect: 'A quiet moment to look more closely.', guide: 'A quiet portrait; no steps were taken.'
        };
        announce(still[type]);
    }
    else {
        const active = {
            moth: 'A little distraction. Watch who notices the moth.', shadow: 'A passing shadow. Give this visitor time to recover.',
            return: 'An invitation back to familiar ground.', inspect: 'A closer look, at a gecko’s own pace.', guide: 'A new direction to explore.'
        };
        announce(active[type]);
    }
}
function direct(type) {
    if (!geckoDemo || demoDisposed)
        return;
    try {
        const state = geckoDemo.getDirectorSnapshot();
        const id = state?.selectedId;
        const intent = id ? { type, id } : { type };
        reportAction(geckoDemo.direct(intent), type);
        reflect();
    }
    catch (error) {
        reportFailure(error, 'encounter');
    }
}
function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = demoDocument.createElement('a');
    try {
        link.href = url;
        link.download = filename;
        link.hidden = true;
        demoDocument.body.appendChild(link);
        link.click();
    }
    finally {
        link.remove();
        URL.revokeObjectURL(url);
    }
}
try {
    geckoDemo = mountGecko(canvas, {
        onStatus: refresh,
        ...(hasDirectorUI ? { director: INITIAL_DIRECTOR } : {})
    });
    reflect();
    listen(pause, 'click', () => {
        if (!geckoDemo)
            return;
        const paused = !geckoDemo.getStatus().paused;
        geckoDemo.setPaused(paused);
        announce(paused ? 'Paused. Take your time.' : geckoDemo.getStatus().reducedMotion ? 'Reduced motion keeps the scene still.' : 'The night continues.');
    });
    listen(element('reset'), 'click', () => {
        geckoDemo?.reset();
        reflect();
        announce('Back to the beginning. Your playback preference is preserved.');
    });
    listen(startle, 'click', () => {
        if (hasDirectorUI) {
            direct('shadow');
            return;
        }
        if (!geckoDemo)
            return;
        const status = geckoDemo.getStatus();
        if (!status.paused && !status.reducedMotion && isBusy(status.phase)) {
            announce('The gecko is still recovering. Give it a moment.');
            return;
        }
        reportAction(geckoDemo.startle(), 'shadow');
    });
    for (const button of demoDocument.querySelectorAll('[data-guide]')) {
        listen(button, 'click', () => {
            const [x, y] = (button.dataset.guide ?? '').split(',').map(Number);
            if (x === undefined || y === undefined)
                return;
            reportAction(geckoDemo?.guide(x, y), 'guide');
        });
    }
    listen(element('rest'), 'click', () => { geckoDemo?.clearGuide(); announce('Guidance released. No need to hurry.'); });
    listen(element('pace'), 'input', event => {
        const value = Number(event.currentTarget.value);
        geckoDemo?.update({ creepSpeed: value });
        element('pace-value').textContent = value < .07 ? 'Slow' : value > .13 ? 'Brisk' : 'Gentle';
    });
    listen(element('curl'), 'input', event => {
        const value = Number(event.currentTarget.value);
        geckoDemo?.update({ curlStrength: value });
        element('curl-value').textContent = `${Math.round(value * 100)}%`;
    });
    listen(element('neutral'), 'change', event => {
        geckoDemo?.setView({ neutral: event.currentTarget.checked });
    });
    if (hasDirectorUI) {
        for (const scene of Object.keys(SCENES)) {
            listenOptional(`scene-${scene}`, 'click', () => configure({ scene }, SCENES[scene].invitation));
        }
        for (const id of CAST) {
            listenOptional(`select-${id}`, 'click', () => {
                geckoDemo?.selectGecko(id);
                reflect();
                const animal = geckoDemo?.getDirectorSnapshot()?.individuals.find(item => item.id === id);
                if (animal)
                    announce(`Following ${animal.label}. ${MOTIVES[animal.motive].short}.`);
            });
            listenOptional(`role-${id}`, 'change', event => {
                const state = geckoDemo?.getDirectorSnapshot();
                if (!state)
                    return;
                const value = event.currentTarget.value;
                if (value !== 'scout' && value !== 'hunter' && value !== 'sentry')
                    return;
                const position = CAST.indexOf(id);
                const roleAt = (index) => index === position ? value : state.options.roles[index] ?? ROLE_DEFAULTS[index];
                // Preserve absent visitors' assignments when the population is reduced.
                const roles = [roleAt(0), roleAt(1), roleAt(2)];
                configure({ roles }, 'A new role, and a different reason to explore.');
            });
        }
        listenOptional('population', 'input', event => configure({ population: Number(event.currentTarget.value) }));
        listenOptional('tempo', 'input', event => configure({ tempo: Number(event.currentTarget.value) }));
        listenOptional('boldness', 'input', event => configure({ boldness: Number(event.currentTarget.value) }));
        listenOptional('autonomy', 'change', event => configure({ autonomy: event.currentTarget.checked }));
        listenOptional('show-routes', 'change', event => configure({ showRoutes: event.currentTarget.checked }));
        listenOptional('reverse', 'change', event => configure({ reverse: event.currentTarget.checked }));
        listenOptional('moth', 'click', () => direct('moth'));
        listenOptional('return', 'click', () => direct('return'));
        listenOptional('inspect', 'click', () => direct('inspect'));
        listen(canvas, 'pointerdown', () => { const cue = optional('canvas-cue'); if (cue)
            cue.hidden = true; });
        listenOptional('export-png', 'click', () => {
            if (demoDisposed)
                return;
            if (!canvas.width || !canvas.height) {
                announce('The wall needs a visible canvas before it can be saved as an image.');
                return;
            }
            try {
                canvas.toBlob(blob => {
                    if (demoDisposed)
                        return;
                    if (!blob) {
                        announce('This browser could not create an image. The text portrait is still available.');
                        return;
                    }
                    try {
                        download(blob, 'gecko-after-dark.png');
                        announce('An image of the wall is ready to save.');
                    }
                    catch (error) {
                        reportFailure(error, 'image download');
                    }
                }, 'image/png');
            }
            catch (error) {
                reportFailure(error, 'image capture');
            }
        });
        listenOptional('export-text', 'click', () => {
            if (!geckoDemo || demoDisposed)
                return;
            try {
                download(new Blob([geckoDemo.exportText()], { type: 'text/plain;charset=utf-8' }), 'gecko-portrait.txt');
                announce('The character portrait is ready to keep.');
            }
            catch (error) {
                reportFailure(error, 'text download');
            }
        });
        listenOptional('export-settings', 'click', () => {
            if (!geckoDemo || demoDisposed)
                return;
            try {
                const recipe = geckoDemo.exportScene();
                if (!recipe) {
                    announce('There is no directed scene to save.');
                    return;
                }
                download(new Blob([JSON.stringify(recipe, null, 2) + '\n'], { type: 'application/json' }), 'gecko-scene.json');
                announce('The scene settings are ready to keep.');
            }
            catch (error) {
                reportFailure(error, 'settings download');
            }
        });
    }
}
catch (error) {
    geckoDemo?.dispose();
    geckoDemo = null;
    for (const release of listeners.splice(0).reverse())
        release();
    fallback.hidden = false;
    fallbackMessage.textContent = 'The animated canvas is unavailable here. Each gecko has a broad head, four splayed pad-toed feet, and a long attached tail. A plain-text portrait is available below.';
    phase.textContent = 'Text portrait';
    help.textContent = 'A quiet text portrait is available below.';
    for (const control of demoDocument.querySelectorAll('.interaction-panel button, .interaction-panel input, .interaction-panel select, .playback button, .scene-director button, .direction-desk input, .direction-desk button, .tuning input, .export-actions button'))
        control.disabled = true;
    announce('Animation unavailable; the plain-text portrait remains usable.');
    console.warn('Gecko canvas unavailable', error);
}
listen(element('refresh-text'), 'click', refreshText);
listen(element('text-details'), 'toggle', event => {
    if (event.currentTarget.open)
        refreshText();
});
refreshText();
function disposeDemo() {
    if (demoDisposed)
        return;
    demoDisposed = true;
    geckoDemo?.dispose();
    for (const release of listeners.splice(0).reverse())
        release();
}
listen(demoWindow, 'pagehide', event => {
    // Keep the host and its controls intact in bfcache. The controller freezes
    // independently and redraws on pageshow without overriding explicit pause.
    if (!event.persisted)
        disposeDemo();
});
