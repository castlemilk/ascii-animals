import { createFrogArtwork as mountFrog } from './runtime/public/frog.js';
const canvas = document.querySelector('#frog');
const status = document.querySelector('#status');
const pause = document.querySelector('#pause');
const target = document.querySelector('#target');
const poses = document.querySelector('#pose');
const count = document.querySelector('#count');
const layout = document.querySelector('#layout');
const tempo = document.querySelector('#tempo');
const autonomy = document.querySelector('#autonomy');
const sceneInputs = [...document.querySelectorAll('input[name="scene"]')];
const cleanups = [];
let controller;
let snapshot;
const scenes = {
    stillwater: { title: 'Stillwater', purpose: 'Make room for a quiet moment. A glance, a gentle breath, an occasional change of lily pad.', arc: 'Rest → listen → a considered hop → rest' },
    'firefly-supper': { title: 'Firefly supper', purpose: 'A small light catches a hunter’s eye. Attention becomes a committed leap, then the pond settles again.', arc: 'Notice → track → hop & strike → settle' },
    'moonlit-chorus': { title: 'Moonlit chorus', purpose: 'One frog calls across the water. Its neighbors answer in turn, leaving a little silence between phrases.', arc: 'Listen → call → answer → quiet' }
};
const phaseNames = { opening: 'Finding the rhythm', activity: 'A moment of activity', settling: 'Settling back', quiet: 'A little quiet' };
const roles = { caller: 'Starts a conversation', hunter: 'Watches for supper', dreamer: 'Takes the long pause' };
function on(selector, event, fn) {
    const element = document.querySelector(selector);
    element.addEventListener(event, fn);
    cleanups.push(() => element.removeEventListener(event, fn));
}
function text(selector, value) {
    const element = document.querySelector(selector);
    if (element.textContent !== value)
        element.textContent = value;
}
function motive(actor) {
    const state = actor.motive;
    switch (state.kind) {
        case 'rest': return 'Resting on the water';
        case 'listen': return 'Listening nearby';
        case 'call': return state.reply ? 'Answering a neighbor' : 'Calling across the pond';
        case 'track': return 'Watching the firefly';
        case 'hop': return actor.model.behavior.kind === 'crouch' ? 'Gathering for a hop' : actor.model.behavior.kind === 'flight' ? 'On the way to a new pad' : 'Finding its footing';
        case 'strike': return 'Reaching for supper';
        case 'settle': return 'Settling into stillness';
    }
}
function syncStatus() {
    if (!controller)
        return;
    const state = controller.getStatus();
    pause.textContent = state.paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-pressed', String(state.paused));
    text('#motion-note', state.reducedMotion ? 'Reduced motion · deliberate still studies' : state.paused ? 'Paused · choose a pose or a still expression' : 'Motion on · pause whenever you like');
}
function onAction(message) {
    status.textContent = message;
    // These deliberate controller notices also cover focused-canvas keyboard
    // actions. An expression is not one of the four anatomical pose choices.
    if (/^Static (call|hunt|ripple) study\./.test(message))
        poses.value = '';
    else {
        const pose = /^Static (rest|crouch|airborne|landed) pose\./.exec(message)?.[1];
        if (pose)
            poses.value = pose;
    }
    syncStatus();
}
function syncPond(state) {
    const configChanged = snapshot?.config !== state.config;
    snapshot = state;
    const scene = scenes[state.config.scene];
    text('#scene-title', scene.title);
    text('#scene-purpose', scene.purpose);
    text('#scene-arc', scene.arc);
    text('#scene-phase', state.config.autonomy ? phaseNames[state.scenePhase] : 'Following your lead');
    // A live snapshot must not undo an in-progress range drag before its change.
    if (configChanged) {
        for (const input of sceneInputs)
            input.checked = input.value === state.config.scene;
        count.value = String(state.config.count);
        layout.value = state.config.layout;
        tempo.value = String(state.config.tempo);
        text('#tempo-value', `${state.config.tempo.toFixed(2).replace(/0$/, '')}×`);
        autonomy.checked = state.config.autonomy;
    }
    for (let id = 0; id < 3; id++) {
        const actor = state.actors.find(item => item.id === id);
        const card = document.querySelector(`#actor-${id}`);
        card.hidden = !actor;
        if (!actor)
            continue;
        const selected = actor.id === state.selectedId;
        card.setAttribute('data-selected', String(selected));
        const button = document.querySelector(`#select-${id}`);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', `Select ${actor.name}, frog ${actor.id + 1}`);
        text(`#motive-${id}`, motive(actor));
        text(`#role-note-${id}`, roles[actor.role]);
        document.querySelector(`#role-${id}`).value = actor.role;
        if (selected)
            text('#selected-name', actor.name);
    }
    const selectedActor = state.actors.find(actor => actor.id === state.selectedId);
    for (const pad of state.pads) {
        const option = target.options[pad.id + 1];
        const owner = state.actors.find(actor => actor.padId === pad.id || actor.reservedPad === pad.id);
        const reachable = Math.hypot(pad.point.x - selectedActor.model.position.x, pad.point.y - selectedActor.model.position.y)
            <= selectedActor.model.config.maxDistance + 1e-10;
        option.textContent = `${pad.label}${owner ? ` · ${owner.name}${owner.reservedPad === pad.id ? ' landing' : ''}` : reachable ? ' · free' : ' · out of reach'}`;
        option.disabled = Boolean(owner) || !reachable;
    }
    const unavailableAim = state.target !== null && state.previewPad === null;
    target.options[7].hidden = !unavailableAim;
    target.value = state.previewPad !== null ? String(state.previewPad) : unavailableAim ? 'unavailable' : '';
    // A mount-time snapshot may arrive before mountFrog has returned its controller.
    syncStatus();
}
try {
    await document.fonts?.ready;
    controller = mountFrog(canvas, {
        director: { scene: 'moonlit-chorus', count: 3, layout: 'arc', tempo: 1, autonomy: true, roles: ['caller', 'hunter', 'dreamer'] },
        preview: { cols: 180, rows: 100, labels: true, trajectories: false, renderFps: 20 },
        onAction,
        onPondChange: syncPond
    });
    const initial = controller.getPondState();
    if (initial)
        syncPond(initial);
    syncStatus();
    if (controller.getStatus().reducedMotion)
        status.textContent = 'Reduced motion is active. Hop cycles still poses; Call, Lure firefly and Ripple show quiet representative studies.';
    for (const input of sceneInputs)
        on(`#${input.id}`, 'change', () => {
            if (!input.checked)
                return;
            controller.updateDirector({ scene: input.value });
            poses.value = '';
            syncStatus();
        });
    on('#count', 'change', () => { controller.updateDirector({ count: Number(count.value) }); poses.value = ''; syncStatus(); });
    on('#layout', 'change', () => { controller.updateDirector({ layout: layout.value }); poses.value = ''; syncStatus(); });
    on('#tempo', 'input', () => text('#tempo-value', `${Number(tempo.value).toFixed(2).replace(/0$/, '')}×`));
    on('#tempo', 'change', () => { controller.updateDirector({ tempo: Number(tempo.value) }); poses.value = ''; syncStatus(); });
    on('#autonomy', 'change', () => { controller.updateDirector({ autonomy: autonomy.checked }); poses.value = ''; syncStatus(); });
    for (let id = 0; id < 3; id++) {
        on(`#select-${id}`, 'click', () => controller.selectFrog(id));
        on(`#role-${id}`, 'change', event => controller.setRole(id, event.target.value));
    }
    on('#leap', 'click', () => controller.leap());
    on('#call', 'click', () => controller.call());
    on('#hunt', 'click', () => controller.hunt());
    on('#ripple', 'click', () => controller.ripple());
    on('#pause', 'click', () => { controller.setPaused(!controller.getStatus().paused); poses.value = ''; syncStatus(); });
    on('#reset', 'click', () => { controller.reset(); poses.value = ''; syncStatus(); });
    on('#target', 'change', () => {
        const pad = target.value === '' ? undefined : snapshot?.pads.find(item => item.id === Number(target.value));
        if (pad)
            controller.target(pad.point);
        else
            controller.clearTarget();
    });
    on('#pose', 'change', () => { if (poses.value)
        controller.setStaticPose(poses.value); syncStatus(); });
    on('#view', 'change', event => controller.updatePreview({ view: event.target.value }));
    on('#size', 'change', event => { controller.updateConfig({ size: Number(event.target.value) }); poses.value = ''; });
    on('#height', 'change', event => { controller.updateConfig({ jumpHeight: Number(event.target.value) }); poses.value = ''; });
    on('#labels', 'change', event => controller.updatePreview({ labels: event.target.checked }));
    on('#trajectories', 'change', event => controller.updatePreview({ trajectories: event.target.checked }));
    on('#silhouette', 'change', event => controller.updatePreview({ silhouette: event.target.checked }));
    on('#text', 'click', () => { const pre = document.querySelector('#specimen'); pre.textContent = controller.exportText(); pre.hidden = false; });
    const dispose = () => { for (const remove of cleanups.splice(0))
        remove(); controller?.dispose(); };
    // A cached page keeps its controller and handlers; visibility suspension is
    // owned by the controller. A later real navigation still needs this listener.
    const pagehide = (event) => { if (!event.persisted)
        dispose(); };
    window.addEventListener('pagehide', pagehide);
    cleanups.push(() => window.removeEventListener('pagehide', pagehide));
    // Demo-local review hook. It is not a package/global engine API.
    Object.defineProperty(window, '__frogDemo', { value: Object.freeze({ controller, dispose }), configurable: true });
}
catch (error) {
    for (const remove of cleanups.splice(0))
        remove();
    controller?.dispose();
    canvas.hidden = true;
    document.querySelector('#fallback').hidden = false;
    for (const control of document.querySelectorAll('button,input,select'))
        control.disabled = true;
    status.textContent = error instanceof Error ? error.message : 'The interactive pond could not initialize.';
}
