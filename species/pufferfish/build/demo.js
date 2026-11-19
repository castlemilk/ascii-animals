import { mountPufferfish } from './controller.js';
function element(id) {
    const value = document.getElementById(id);
    if (!value)
        throw new Error(`Missing demo control: ${id}`);
    return value;
}
const scenes = {
    reef: { title: 'Reef ramble', note: 'Drift, brake, hover, inspect. Invite a visitor to a quiet point in the open water.' },
    current: { title: 'Returning tide', note: 'The current rises. Watch the visitors paddle, shelter, then venture out into slack water.' },
    shadow: { title: 'Passing shadow', note: 'A watchful pause, a local defence, then confidence returning. Give the group room to settle.' },
};
const beats = {
    discover: 'Drifting toward a discovery', inspect: 'A cautious inspection', gather: 'Backing into open water', rest: 'Drifting at ease',
    rising: 'The tide is rising', shelter: 'Finding a sheltered spot', returning: 'Into the returning tide', slack: 'A moment of slack water',
    watch: 'Keeping a gentle watch', shadow: 'Something passes overhead', release: 'The water feels safe again', resume: 'Curiosity returns',
};
const phases = {
    idle: 'At ease', approach: 'Braking and watching', inflating: 'Belly unfolding', holding: 'Round and watchful',
    recovering: 'Release, hesitate, settle', cooldown: 'Regaining the current',
};
const roleNotes = {
    explorer: 'An eager visitor, drawn to new places and quiet invitations.',
    sentinel: 'A watchful neighbour, pausing to inspect the water around it.',
    drifter: 'An unhurried traveller, content to move with the current.',
};
const defaultRoles = ['explorer', 'sentinel', 'drifter'];
const initialDirector = {
    scene: 'reef', count: 2, tempo: 1, current: .35, curiosity: .75, spacing: 1, size: 1, labels: true,
    roles: ['explorer', 'sentinel'],
};
const tuning = ['current', 'tempo', 'curiosity', 'size', 'spacing'];
let controller = null;
let interactions = null;
let textUrl = null;
function mountDemo() {
    if (controller)
        return;
    const canvas = element('pufferfish');
    const status = element('status'), fallback = element('fallback');
    const pause = element('pause');
    const scope = new AbortController();
    interactions = scope;
    let lastConfig = null;
    let lastBeat = '';
    let lastSelected = -1;
    let lastRole = null;
    const on = (id, type, callback) => {
        element(id).addEventListener(type, event => {
            try {
                callback(event);
            }
            catch (error) {
                status.textContent = error instanceof Error ? error.message : 'This setting could not be applied.';
            }
        }, { signal: scope.signal });
    };
    const updateTuningLabels = () => {
        for (const key of tuning) {
            const value = Number(element(key).value);
            element(`${key}-value`).value = key === 'current'
                ? `${value > 0 ? '+' : ''}${value.toFixed(2)}${value === 0 ? ' · still' : value < 0 ? ' · left' : ' · right'}`
                : key === 'curiosity' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}×`;
        }
    };
    const syncConfig = (config) => {
        if (config === lastConfig)
            return;
        lastConfig = config;
        for (const key of tuning)
            element(key).value = String(config[key]);
        element('count').value = String(config.count);
        element('labels').checked = config.labels;
        element('apply-director').disabled = true;
        element('tuning-note').textContent = 'Apply a new current or pace to begin the scene again. Your pause setting stays put.';
        updateTuningLabels();
    };
    const showStatus = (next) => {
        const snapshot = controller?.getDirectorSnapshot();
        const director = next.director;
        const selected = director?.actors[director.selected];
        const title = director ? scenes[director.scene].title : 'A little breathing room';
        const beat = director ? beats[director.beat] ?? director.beat : phases[next.phase];
        element('scene-title').textContent = title;
        element('phase').textContent = beat;
        element('scene-description').textContent = director ? scenes[director.scene].note : next.description;
        element('scene-beat').textContent = beat;
        element('motion-label').textContent = next.running ? 'IN THE CURRENT' : 'STILL WATERS';
        pause.textContent = next.userPaused ? 'Resume' : 'Pause';
        pause.setAttribute('aria-pressed', String(next.userPaused));
        const still = next.reducedMotion || next.userPaused || next.compact;
        element('motion-note').hidden = !still;
        element('motion-note').textContent = next.reducedMotion
            ? 'Your reduced-motion preference is active. Select, Invite, Approach and Give space choose still compositions.'
            : next.compact ? 'This small view uses still compositions. All introductions and individual controls remain available.'
                : 'Paused. Select, Invite, Approach and Give space choose still compositions without resuming.';
        for (const scene of ['reef', 'current', 'shadow']) {
            element(`scene-${scene}`).setAttribute('aria-pressed', String(director?.scene === scene));
        }
        if (snapshot)
            syncConfig(snapshot.config);
        if (director) {
            for (let id = 0; id < 3; id++) {
                const actor = director.actors[id];
                const button = element(`actor-${id}`);
                button.hidden = !actor;
                if (!actor)
                    continue;
                button.setAttribute('aria-pressed', String(id === director.selected));
                button.setAttribute('aria-label', `Select ${actor.name}, ${actor.role}, ${actor.motive}`);
                element(`actor-${id}-name`).textContent = actor.name;
                element(`actor-${id}-role`).textContent = actor.role;
                element(`actor-${id}-motive`).textContent = actor.motive;
            }
        }
        if (selected) {
            element('selected-name').textContent = selected.name;
            element('selected-phase').textContent = phases[selected.phase];
            element('actor-detail').textContent = `${roleNotes[selected.role]} Right now: ${selected.motive}.`;
            if (selected.id !== lastSelected || selected.role !== lastRole)
                element('role').value = selected.role;
            lastRole = selected.role;
            const watch = Math.round(selected.threat * 100);
            element('watchfulness').value = selected.threat;
            element('watchfulness-value').textContent = watch < 20 ? 'At ease' : watch < 55 ? 'Attentive' : 'On guard';
        }
        const beatKey = director ? `${director.scene}:${director.beat}` : '';
        if (beatKey && beatKey !== lastBeat && lastBeat)
            status.textContent = `${title}: ${beat}.`;
        else if (selected && selected.id !== lastSelected && lastSelected !== -1)
            status.textContent = `${selected.name} selected. ${roleNotes[selected.role]}`;
        lastBeat = beatKey;
        if (selected)
            lastSelected = selected.id;
    };
    const showError = (error) => {
        fallback.hidden = false;
        status.textContent = `The animation is unavailable: ${error instanceof Error ? error.message : 'Canvas could not start'}`;
        for (const node of document.querySelectorAll('.controls button,.controls select,.controls input,.scene-choice,#capture-text'))
            node.disabled = true;
        element('download-text').removeAttribute('href');
        element('download-text').setAttribute('aria-disabled', 'true');
    };
    const actionMessage = (result, moving, still) => {
        status.textContent = result.kind === 'suspended' ? 'The scene is resting while its canvas is out of sight or has no size.'
            : result.kind === 'static-poster' ? `${still} Still view remains active.` : moving;
    };
    const captureText = () => {
        const text = controller.exportText();
        element('text-frame').textContent = text;
        if (textUrl)
            URL.revokeObjectURL(textUrl);
        textUrl = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }));
        element('download-text').href = textUrl;
        status.textContent = 'The current logical character frame is ready below.';
    };
    try {
        // A back/forward-cache remount starts the same explicit demo defaults.
        for (const node of document.querySelectorAll('.controls button,.controls select,.controls input,.scene-choice,#capture-text'))
            node.disabled = false;
        element('download-text').removeAttribute('aria-disabled');
        element('view').value = 'right';
        element('quality').value = 'fine';
        element('mode').value = 'ascii';
        element('monochrome').checked = false;
        element('seed').value = '23';
        element('inflation').value = '1.65';
        element('wobble').checked = true;
        const legacy = window.CuttlefishArtwork;
        if (!legacy)
            throw new Error('The artwork source did not load. Serve the repository root and try again.');
        controller = mountPufferfish(canvas, legacy, {
            species: { seed: 23 }, director: initialDirector, render: { quality: 'fine', mode: 'ascii' },
            onError: showError, onChange: showStatus,
        });
        fallback.hidden = true;
        showStatus(controller.getStatus());
        for (const scene of ['reef', 'current', 'shadow'])
            on(`scene-${scene}`, 'click', () => {
                controller.configureDirector({ scene });
                status.textContent = `${scenes[scene].title} begins. ${scenes[scene].note}`;
            });
        for (let id = 0; id < 3; id++)
            on(`actor-${id}`, 'click', () => { controller.selectActor(id); });
        on('count', 'change', () => {
            const count = Number(element('count').value);
            const roles = defaultRoles.slice(0, count);
            controller.configureDirector({ count, roles });
            status.textContent = `${count === 1 ? 'One visitor' : `${count} visitors`} in a fresh scene. Individual roles begin with their defaults.`;
        });
        on('role', 'change', () => {
            const snapshot = controller.getDirectorSnapshot();
            if (!snapshot)
                return;
            const roles = [...snapshot.config.roles];
            roles[snapshot.selected] = element('role').value;
            controller.configureDirector({ roles });
            controller.selectActor(snapshot.selected);
            status.textContent = `Role changed to ${roles[snapshot.selected]}. A fresh scene begins; your pause setting is preserved.`;
        });
        on('invite', 'click', () => { actionMessage(controller.invite(), 'A quiet invitation into the open water. Watch the selected visitor turn and investigate.', 'An invitation shown in a still composition.'); });
        on('approach', 'click', () => { actionMessage(controller.approach(), 'You approached the selected visitor. Give it a moment to notice, then watch its belly and spines.', 'The selected visitor shows its inflated pose.'); });
        on('retreat', 'click', () => { actionMessage(controller.retreat(), 'You gave the whole group space. Invitations clear and the visitors have time to settle.', 'The group returns to a calm composition.'); });
        on('pause', 'click', () => {
            controller.setPaused(!controller.getStatus().userPaused);
            const next = controller.getStatus();
            status.textContent = next.userPaused ? 'Scene paused. Deliberate still actions remain available.'
                : next.reducedMotion ? 'Still view follows your reduced-motion preference.'
                    : next.compact ? 'This small view remains still. Your playback preference is saved.' : 'The scene continues.';
        });
        on('reset', 'click', () => { controller.reset(); status.textContent = 'Same visitors, same seed, a fresh scene. Your pause and scene settings are preserved.'; });
        for (const key of tuning)
            on(key, 'input', () => {
                updateTuningLabels();
                element('apply-director').disabled = false;
                element('tuning-note').textContent = 'Your adjustments are ready. Apply them to begin a fresh scene.';
            });
        on('apply-director', 'click', () => {
            controller.configureDirector({
                current: Number(element('current').value), tempo: Number(element('tempo').value),
                curiosity: Number(element('curiosity').value), size: Number(element('size').value),
                spacing: Number(element('spacing').value),
            });
            status.textContent = 'The new current and character settings are in place. A fresh scene begins.';
        });
        on('labels', 'change', () => { controller.configureDirector({ labels: element('labels').checked }); status.textContent = 'Individual labels updated. The scene begins again.'; });
        on('view', 'change', () => { controller.configureRender({ view: element('view').value }); });
        on('quality', 'change', () => { controller.configureRender({ quality: element('quality').value }); });
        on('mode', 'change', () => { controller.configureRender({ mode: element('mode').value }); });
        on('monochrome', 'change', () => { controller.configureRender({ monochrome: element('monochrome').checked }); });
        on('apply-character', 'click', () => {
            controller.configure({ seed: Number(element('seed').value),
                inflationScale: Number(element('inflation').value), wobble: element('wobble').checked ? 1 : 0 });
            status.textContent = 'Character settings applied. The scene starts again with your pause setting preserved.';
        });
        on('capture-text', 'click', captureText);
        on('download-text', 'click', captureText);
    }
    catch (error) {
        controller?.destroy();
        controller = null;
        scope.abort();
        showError(error);
    }
}
function disposeDemo() {
    controller?.destroy();
    controller = null;
    interactions?.abort();
    interactions = null;
    if (textUrl)
        URL.revokeObjectURL(textUrl);
    textUrl = null;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('pagehide', disposeDemo);
    window.addEventListener('pageshow', mountDemo);
    mountDemo();
}
