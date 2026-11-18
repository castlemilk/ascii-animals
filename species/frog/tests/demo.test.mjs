/** Host markup and a deliberately small DOM double. Neither proves browser layout or Canvas rendering. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const file = new URL('../demo/index.html', import.meta.url), html = readFileSync(file, 'utf8');
const source = readFileSync(new URL('../src/demo.mts', import.meta.url), 'utf8');
const select = id => html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
const values = id => [...select(id).matchAll(/<option\s+value="([^"]*)"/g)].map(x => x[1]);

test('demo exposes scenes, bounded direction, actor roles, actions and original still poses', () => {
  assert.doesNotMatch(html, /<\/[a-zA-Z][\w:-]*\s+[^>]+>/, 'closing tags cannot carry attributes');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['frog', 'leap', 'call', 'hunt', 'ripple', 'pause', 'reset', 'target', 'pose', 'status', 'fallback', 'instructions', 'count', 'layout', 'tempo', 'autonomy', 'labels', 'trajectories', 'silhouette']) assert(ids.includes(id), id);
  const scenes = [...html.matchAll(/<input[^>]+name="scene"[^>]+value="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(scenes, ['stillwater', 'firefly-supper', 'moonlit-chorus']);
  assert.deepEqual(values('count'), ['1', '2', '3']);
  assert.deepEqual(values('layout'), ['arc', 'stepping-stones', 'shelter']);
  assert.deepEqual(values('pose'), ['', 'rest', 'crouch', 'airborne', 'landed']);
  assert.deepEqual(values('target'), ['', '0', '1', '2', '3', '4', '5', 'unavailable']);
  assert.deepEqual(values('view'), ['front', 'left', 'right', 'profile']);
  for (let id = 0; id < 3; id++) assert.deepEqual(values(`role-${id}`), ['caller', 'hunter', 'dreamer']);
  assert.match(html, /id="tempo"[^>]+min="0\.5"[^>]+max="1\.5"/);
  for (const [, id] of html.matchAll(/<label[^>]+\bfor="([^"]+)"/g)) assert(ids.includes(id), `label ${id}`);
  for (const [, targets] of html.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) for (const id of targets.split(' ')) assert(ids.includes(id), `description ${id}`);
});

test('demo uses local assets and integrated factory rewrite, with sparse announcements and a candid fallback', () => {
  for (const [, relative] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (relative.startsWith('#')) continue;
    assert(!/^https?:/.test(relative), 'demo must not depend on remote assets');
    assert(existsSync(new URL(relative, file)), relative);
  }
  assert.doesNotMatch(html, /artwork\.js/);
  assert.match(source, /import \{ mountFrog \} from '\.\/controller\.mjs';/);
  assert.equal([...html.matchAll(/aria-live="/g)].length, 1, 'actor and scene updates must not be live regions');
  assert.match(html, /id="status" role="status" aria-live="polite"/);
  assert.match(html, /aria-describedby="instructions"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<img[^>]+alt="Static glyph-rendered frog from the earlier single-frog study/);
  assert.match(html, /Dragging scrolls the page without triggering an action/);
  assert.doesNotMatch(source, /(?:requestAnimationFrame|setInterval|setTimeout)\s*\(/, 'demo must share controller updates, with no extra clock');
});

class ElementDouble {
  constructor(id = '') { this.id = id; this.listeners = new Map(); this.attributes = new Map(); this.value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.options = []; }
  addEventListener(type, fn) { const listeners = this.listeners.get(type) ?? new Set(); listeners.add(fn); this.listeners.set(type, listeners); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  fire(type, event = {}) { for (const fn of [...this.listeners.get(type) ?? []]) fn({ target: this, ...event }); }
}
function pondFixture() {
  return Object.freeze({ config: Object.freeze({ scene: 'moonlit-chorus', count: 3, layout: 'arc', tempo: 1, autonomy: true }), selectedId: 0, target: null, previewPad: null, scenePhase: 'opening',
    actors: Object.freeze(['Moss', 'Pip', 'Fern'].map((name, id) => Object.freeze({ id, name, role: ['caller', 'hunter', 'dreamer'][id], padId: id, reservedPad: null, motive: Object.freeze({ kind: 'rest', age: 0 }), model: Object.freeze({ behavior: { kind: 'idle' }, position: { x: id / 5, y: -.2 }, config: { maxDistance: .9 } }) }))),
    pads: Object.freeze(Array.from({ length: 6 }, (_, id) => Object.freeze({ id, label: `Pad ${id + 1}`, point: Object.freeze({ x: id / 5, y: -.2 }) }))) });
}
async function mountDemo({ fail = false } = {}) {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new ElementDouble(id)]));
  const sceneInputs = ['scene-stillwater', 'scene-firefly', 'scene-chorus'].map((id, i) => { const input = elements.get(id); input.value = ['stillwater', 'firefly-supper', 'moonlit-chorus'][i]; return input; });
  elements.get('target').options = values('target').map(value => Object.assign(new ElementDouble(), { value }));
  elements.get('fallback').hidden = true;
  const window = new ElementDouble();
  const document = { fonts: { ready: Promise.resolve() }, querySelector(selector) { const element = elements.get(selector.slice(1)); assert(element, selector); return element; }, querySelectorAll(selector) { if (selector === 'input[name="scene"]') return sceneInputs; if (selector === 'button,input,select') return [...elements.values()]; throw new Error(`Unsupported DOM-double selector ${selector}`); } };
  const calls = [], state = pondFixture(); let options;
  const status = { paused: false, reducedMotion: false, staticPose: 'rest' };
  const controller = { getPondState: () => state, getStatus: () => status, exportText: () => 'frog cells', setPaused(value) { calls.push(['setPaused', value]); status.paused = value; }, dispose() { calls.push(['dispose']); } };
  for (const name of ['updateDirector', 'selectFrog', 'setRole', 'call', 'hunt', 'ripple', 'target', 'leap', 'clearTarget', 'reset', 'setStaticPose', 'updateConfig', 'updatePreview']) controller[name] = (...args) => calls.push([name, ...args]);
  for (const name of ['call', 'hunt', 'ripple']) controller[name] = () => { calls.push([name]); if (status.paused || status.reducedMotion) { status.staticPose = 'rest'; options.onAction(`Static ${name} study. Motion stays off.`); } };
  controller.setStaticPose = value => { calls.push(['setStaticPose', value]); status.staticPose = value; status.paused = true; options.onAction(`Static ${value} pose. Playback paused.`); };
  const mountFrog = (_canvas, passed) => { options = passed; if (fail) throw new Error('Canvas double unavailable'); passed.onPondChange(state); passed.onAction('Mounted without a second clock.'); return controller; };
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  await vm.runInNewContext(`(async () => { ${compiled}\n })()`, { document, window, exports: {}, require(name) { assert.equal(name, './controller.mjs'); return { mountFrog }; }, Error });
  return { elements, window, calls, options, state, status };
}

test('DOM double: synchronous mount snapshots, actor selection, role/action wiring and cleanup', async () => {
  const demo = await mountDemo(), e = id => demo.elements.get(id);
  assert.equal(e('fallback').hidden, true, 'initial callback must not dereference an unassigned controller');
  assert.equal(e('scene-title').textContent, 'Moonlit chorus');
  assert.equal(demo.options.director.count, 3);
  assert.equal(demo.options.preview.cols, 180);
  assert.equal(e('target').options[1].disabled, true);
  assert.equal(e('target').options[4].disabled, false);
  e('tempo').value = '1.25'; e('tempo').fire('input');
  demo.options.onPondChange({ ...demo.state, scenePhase: 'activity' });
  assert.equal(e('tempo').value, '1.25', 'live snapshots preserve an in-progress range drag');
  assert.equal(e('tempo-value').textContent, '1.25×');
  e('select-1').fire('click'); e('role-1').value = 'dreamer'; e('role-1').fire('change');
  for (const id of ['leap', 'call', 'hunt', 'ripple']) e(id).fire('click');
  e('target').value = '4'; e('target').fire('change');
  assert.deepEqual(demo.calls.slice(0, 6), [['selectFrog', 1], ['setRole', 1, 'dreamer'], ['leap'], ['call'], ['hunt'], ['ripple']]);
  assert.deepEqual(demo.calls[6], ['target', demo.state.pads[4].point]);
  e('pause').fire('click'); assert.equal(e('pause').textContent, 'Resume'); assert.equal(e('pause').attributes.get('aria-pressed'), 'true');
  e('text').fire('click'); assert.equal(e('specimen').textContent, 'frog cells');
  const before = e('status').textContent;
  demo.options.onPondChange({ ...demo.state, selectedId: 1, config: { ...demo.state.config, count: 2, scene: 'firefly-supper' }, actors: demo.state.actors.slice(0, 2).map(actor => actor.id === 1 ? { ...actor, motive: { kind: 'track', age: 4 } } : actor) });
  assert.equal(e('actor-2').hidden, true); assert.equal(e('selected-name').textContent, 'Pip'); assert.equal(e('motive-1').textContent, 'Watching the firefly');
  assert.equal(e('status').textContent, before, 'automatic snapshots must not announce');
  demo.window.fire('pagehide');
  assert.equal(demo.calls.at(-1)[0], 'dispose');
  for (const element of demo.elements.values()) for (const listeners of element.listeners.values()) assert.equal(listeners.size, 0);
});

test('DOM double: native director controls route validated-domain values, initialization failure reveals fallback', async () => {
  const demo = await mountDemo(), e = id => demo.elements.get(id);
  e('scene-stillwater').checked = true; e('scene-stillwater').fire('change');
  e('count').value = '2'; e('count').fire('change'); e('layout').value = 'shelter'; e('layout').fire('change');
  e('tempo').value = '0.5'; e('tempo').fire('change'); e('autonomy').checked = false; e('autonomy').fire('change');
  assert.deepEqual(JSON.parse(JSON.stringify(demo.calls)), [['updateDirector', { scene: 'stillwater' }], ['updateDirector', { count: 2 }], ['updateDirector', { layout: 'shelter' }], ['updateDirector', { tempo: .5 }], ['updateDirector', { autonomy: false }]]);
  const failed = await mountDemo({ fail: true });
  assert.equal(failed.elements.get('frog').hidden, true);
  assert.equal(failed.elements.get('fallback').hidden, false);
  assert.match(failed.elements.get('status').textContent, /Canvas double unavailable/);
  assert.equal(failed.elements.get('call').disabled, true);
  demo.window.__frogDemo.dispose();
});

test('DOM double: unreachable pad aims remain explicit and can be cleared', async () => {
  const demo = await mountDemo(), target = demo.elements.get('target');
  assert.equal(target.options[6].disabled, true);
  assert.match(target.options[6].textContent, /out of reach/);
  demo.options.onPondChange({ ...demo.state, target: { x: 1, y: -.2 }, previewPad: null });
  assert.equal(target.value, 'unavailable', 'an invalid pointer aim must not masquerade as nearest-free mode');
  assert.equal(target.options[7].hidden, false);
  target.value = ''; target.fire('change');
  assert.equal(demo.calls.at(-1)[0], 'clearTarget');
  demo.options.onPondChange(demo.state);
  assert.equal(target.options[7].hidden, true);
  assert.equal(target.value, '');
  demo.window.__frogDemo.dispose();
});

test('DOM double: static expressions clear stale pose choices for buttons and controller keyboard notices', async () => {
  const demo = await mountDemo(), pose = demo.elements.get('pose');
  pose.value = 'crouch'; pose.fire('change');
  assert.equal(pose.value, 'crouch');
  demo.elements.get('call').fire('click');
  assert.equal(pose.value, '');
  for (const expression of ['call', 'hunt', 'ripple']) {
    pose.value = 'airborne'; demo.options.onAction(`Static ${expression} study. Motion stays off.`);
    assert.equal(pose.value, '', 'keyboard-triggered controller notices use the same route');
  }
  pose.value = 'rest'; pose.fire('change');
  assert.equal(pose.value, 'rest', 'the explicit Rest pose stays selected');
  demo.options.onAction('Static landed pose. Motion stays off.');
  assert.equal(pose.value, 'landed', 'reduced-motion Hop keeps the posture menu current');
  demo.window.__frogDemo.dispose();
});

test('DOM double: BFCache pagehide preserves controls, later real navigation disposes them', async () => {
  const demo = await mountDemo();
  demo.window.fire('pagehide', { persisted: true });
  assert.equal(demo.calls.some(call => call[0] === 'dispose'), false);
  demo.window.fire('pageshow', { persisted: true });
  demo.elements.get('call').fire('click');
  assert.equal(demo.calls.at(-1)[0], 'call');
  assert.equal(demo.window.listeners.get('pagehide').size, 1);
  demo.window.fire('pagehide', { persisted: false });
  assert.equal(demo.calls.at(-1)[0], 'dispose');
  const calls = demo.calls.length;
  demo.elements.get('call').fire('click');
  assert.equal(demo.calls.length, calls);
});
