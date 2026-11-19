import { createDragonflyArtwork as mountDragonfly } from '../../public/dragonfly.js';
import { createDragonfly } from './model.js';
import { gridToText, rasterizeDragonfly } from './preview.js';
function requireElement(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Dragonfly demo requires #${id}`);
    return element;
}
function initializeDragonflyDemo() {
    const canvas = requireElement('dragonfly');
    const pause = requireElement('pause');
    const dart = requireElement('dart');
    const dartLabel = requireElement('dart-label');
    const perch = requireElement('perch');
    const resume = requireElement('return');
    const reset = requireElement('reset');
    const motion = requireElement('motion');
    const view = requireElement('view');
    const guide = requireElement('guide');
    const population = requireElement('population');
    const route = requireElement('route');
    const neutral = requireElement('neutral');
    const labels = requireElement('labels');
    const phase = requireElement('phase');
    const motionLabel = requireElement('motion-label');
    const populationLabel = requireElement('population-label');
    const selectedLabel = requireElement('selected-label');
    const selectedState = requireElement('selected-state');
    const sceneTitle = requireElement('scene-title');
    const actionStatus = requireElement('action-status');
    const textFrame = requireElement('text-frame');
    const capture = requireElement('capture');
    const capturePng = requireElement('capture-png');
    const fallback = requireElement('canvas-fallback');
    const sceneCards = [...document.querySelectorAll('[data-scene]')];
    const castCards = [...document.querySelectorAll('[data-member]')];
    const roleSelects = [...document.querySelectorAll('[data-role]')];
    const sceneNames = { patrol: 'Pond patrol', attention: 'Hovering attention', relay: 'Reed relay' };
    const phaseNames = { patrol: 'Patrolling', attention: 'Watching', hover: 'Hovering', launch: 'Lifting off', dart: 'Darting', settle: 'Settling', return: 'Returning', land: 'Landing', perched: 'Perched', cooldown: 'Resting' };
    let host = null;
    let pendingVisibleActions = {};
    const teardown = [];
    function status(value) {
        pause.textContent = value.paused ? 'Resume' : 'Pause';
        pause.setAttribute('aria-pressed', String(value.paused));
        const still = value.reducedMotion || value.motion === 'static' || value.paused;
        dartLabel.textContent = still ? 'Change still pose' : 'Dart backward';
        perch.disabled = still;
        resume.disabled = still;
        perch.title = resume.title = still ? 'Flight cues are available in Natural or Slow motion. Change still pose remains available.' : '';
        motionLabel.textContent = value.reducedMotion ? 'REDUCED MOTION · STILL' : `${value.requestedMotion === 'full' ? 'NATURAL' : value.requestedMotion.toUpperCase()} MOTION`;
        const pond = value.director;
        if (!pond)
            return;
        phase.textContent = still ? (value.paused ? 'Paused' : 'Still pond') : ({ arrive: 'Arriving', patrol: 'Patrolling', intercept: 'An encounter', return: 'Returning', rest: 'At rest' }[pond.arc]);
        sceneTitle.textContent = sceneNames[pond.scene];
        population.value = String(pond.members.length);
        populationLabel.textContent = `${String(pond.members.length).padStart(2, '0')} ${pond.members.length === 1 ? 'VISITOR' : 'VISITORS'}`;
        for (const card of sceneCards) {
            const active = card.dataset.scene === pond.scene;
            card.classList.toggle('selected', active);
            card.setAttribute('aria-pressed', String(active));
        }
        for (const card of castCards) {
            const id = Number(card.dataset.member), member = pond.members.find(item => item.id === id);
            card.hidden = !member;
            if (!member)
                continue;
            const active = member.id === pond.selected;
            card.classList.toggle('selected', active);
            card.querySelector('button')?.setAttribute('aria-pressed', String(active));
            const name = card.querySelector('strong');
            if (name)
                name.textContent = member.label;
            const memberPhase = card.querySelector('.member-phase');
            if (memberPhase)
                memberPhase.textContent = still ? 'Still pose' : phaseNames[member.phase.kind] ?? member.phase.kind;
            const role = card.querySelector('select');
            if (role)
                role.value = member.role;
        }
        const chosen = pond.members.find(member => member.id === pond.selected);
        selectedLabel.textContent = chosen ? `${chosen.label} / ${String(pond.selected + 1).padStart(2, '0')}` : 'a visitor';
        selectedState.textContent = chosen ? `${chosen.role[0].toUpperCase()}${chosen.role.slice(1)} · ${still ? 'A moment of stillness.' : phaseNames[chosen.phase.kind] ?? chosen.phase.kind}` : 'Choose a visitor.';
        if (host && !value.hidden && !value.offscreen && !value.zeroSized && !value.disposed)
            flushVisibleActions();
    }
    function listen(target, event, action) { target.addEventListener(event, action); teardown.push(() => target.removeEventListener(event, action)); }
    function announce(message) { actionStatus.textContent = message; }
    function flushVisibleActions() {
        const actions = pendingVisibleActions;
        pendingVisibleActions = {};
        // Selection precedes guide/cue, even if an offscreen control scrolled the
        // canvas and another control was used before IntersectionObserver delivered.
        for (const kind of ['selection', 'guide', 'cue'])
            actions[kind]?.();
    }
    function withVisiblePond(kind, action) {
        if (!host)
            return;
        const value = host.getStatus();
        if (value.hidden || value.zeroSized || value.disposed)
            return;
        pendingVisibleActions[kind] = action;
        if (value.offscreen) {
            announce('Bringing the pond into view.');
            canvas.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
        else
            flushVisibleActions();
    }
    function applyDirector(patch, message) { pendingVisibleActions = {}; host?.configureDirector(patch); announce(message); }
    function cue(action) {
        if (!host)
            return;
        withVisiblePond('cue', () => {
            if (!host)
                return;
            const before = host.getStatus();
            host.cue(action);
            announce(before.paused || before.motion === 'static' || before.reducedMotion ? 'An alternate still pose. The pond remains paused.' : ({ dart: 'A poised lift, a backward dart, then a brake and return to hover.', perch: 'The selected visitor is lowering its feet onto the twig.', return: 'Wings gather speed, feet release, and the visitor returns to flight.' }[action]));
        });
    }
    try {
        host = mountDragonfly(canvas, { director: { scene: 'patrol', count: 3 }, onStatus: status });
        const initial = host.getDirectorOptions();
        route.value = initial.route;
        labels.checked = initial.labels;
        for (const button of sceneCards)
            listen(button, 'click', () => applyDirector({ scene: button.dataset.scene }, `${sceneNames[button.dataset.scene]} selected. Each visitor keeps its identity.`));
        listen(population, 'change', () => applyDirector({ count: Number(population.value) }, `${population.value} visitors in the pond.`));
        listen(route, 'change', () => applyDirector({ route: route.value }, 'The visitors are finding their new route.'));
        listen(labels, 'change', () => applyDirector({ labels: labels.checked }, labels.checked ? 'Visitor labels shown.' : 'Visitor labels hidden.'));
        for (const button of document.querySelectorAll('[data-select]'))
            listen(button, 'click', () => { withVisiblePond('selection', () => { host?.selectIndividual(Number(button.dataset.select)); announce(`Visitor ${String(Number(button.dataset.select) + 1).padStart(2, '0')} selected for your next cue.`); }); });
        for (const role of roleSelects)
            listen(role, 'change', () => {
                if (!host)
                    return;
                const roles = [...host.getDirectorOptions().roles];
                roles[Number(role.dataset.role)] = role.value;
                applyDirector({ roles }, `Visitor ${String(Number(role.dataset.role) + 1).padStart(2, '0')} is now a ${role.value}.`);
            });
        for (const key of ['tempo', 'spread', 'breeze', 'scale']) {
            const input = requireElement(key), output = requireElement(`${key}-value`);
            input.value = String(initial[key]);
            const reflect = () => { output.textContent = Number(input.value).toFixed(key === 'tempo' ? 1 : 2) + (key === 'tempo' ? '×' : ''); };
            reflect();
            listen(input, 'input', reflect);
            listen(input, 'change', () => applyDirector({ [key]: Number(input.value) }, `${key[0].toUpperCase()}${key.slice(1)} adjusted.`));
        }
        listen(pause, 'click', () => { if (!host)
            return; host.setPaused(!host.getStatus().paused); announce(host.getStatus().paused ? 'The pond is paused. Select a visitor or explore a still pose.' : host.getStatus().reducedMotion ? 'Your reduced-motion preference keeps the pond still.' : 'The pond is moving again.'); });
        listen(dart, 'click', () => cue('dart'));
        listen(perch, 'click', () => cue('perch'));
        listen(resume, 'click', () => cue('return'));
        listen(reset, 'click', () => { pendingVisibleActions = {}; host?.reset(); guide.value = 'free'; announce('Returned to the original seed and arrangement. Scene choices and pause are preserved.'); });
        listen(motion, 'change', () => { host?.configure({ motion: motion.value }); announce(host?.getStatus().reducedMotion ? 'Your system requests reduced motion. The pond stays still.' : `${motion.selectedOptions[0]?.textContent ?? 'Motion'} selected.`); });
        listen(view, 'change', () => { host?.setView(view.value); announce('View changed.'); });
        listen(neutral, 'change', () => { host?.setNeutral(neutral.checked); announce(neutral.checked ? 'Neutral silhouettes. Pond context and labels are hidden for this view.' : 'Pond tones restored.'); });
        listen(guide, 'change', () => {
            if (!host)
                return;
            const targets = { left: [-.8, 0], right: [.8, 0], up: [0, -.8], down: [0, .8], center: [0, 0] };
            const target = targets[guide.value];
            if (target)
                withVisiblePond('guide', () => { host?.setTarget(target[0], target[1]); announce(`Guiding the selected visitor ${guide.selectedOptions[0]?.textContent?.toLowerCase() ?? 'toward the center'}.`); });
            else {
                delete pendingVisibleActions.guide;
                host.clearTarget();
                announce('The selected visitor has returned to free flight.');
            }
        });
        listen(capture, 'click', () => { if (host)
            textFrame.textContent = host.exportText(); announce('Captured the pond’s character cells.'); });
        listen(capturePng, 'click', () => {
            if (!host)
                return;
            try {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'dragonfly-pond.png';
                link.click();
                announce('Saved the actual pond canvas as a PNG.');
            }
            catch {
                announce('PNG capture is unavailable in this browser. Capture text remains available.');
            }
        });
        textFrame.textContent = host.exportText();
        listen(document, 'visibilitychange', () => { if (document.hidden)
            pendingVisibleActions = {}; });
        listen(window, 'pagehide', () => { pendingVisibleActions = {}; for (const remove of teardown.splice(0))
            remove(); host?.dispose(); host = null; });
        Object.defineProperty(window, 'dragonflyPreview', { value: host, configurable: true });
    }
    catch (error) {
        for (const remove of teardown.splice(0))
            remove();
        host?.dispose();
        host = null;
        fallback.hidden = false;
        canvas.hidden = true;
        for (const control of document.querySelectorAll('button, select, input'))
            control.disabled = true;
        const poster = createDragonfly({ motion: 'static' });
        textFrame.textContent = gridToText(rasterizeDragonfly(poster.sample(), { cols: 72, rows: 44, view: 'dorsal', neutral: true }));
        poster.dispose();
        announce(error instanceof Error ? error.message : 'The character canvas is unavailable.');
    }
}
if (typeof document !== 'undefined')
    initializeDragonflyDemo();
