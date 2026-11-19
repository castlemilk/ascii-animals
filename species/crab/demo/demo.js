import { createCrabArtwork } from './runtime/public/crab.js';

const $ = id => document.getElementById(id);
const presets = {
  forage: { scene: 'forage', formation: 'arc', tide: .2, current: .25 },
  signals: { scene: 'signals', formation: 'terraces', tide: .15, current: -.2 },
  tide: { scene: 'tide', formation: 'shoreline', tide: .6, current: .65 }
};
const stories = {
  forage: {
    arrive: ['Out of cover', 'The pool is quiet. Small lives venture from their shelters onto the sand.'],
    forage: ['Breakfast on the sand', 'A careful sideways step. A lowered claw. Each resident searches its own patch.'],
    signal: ['A small discovery', 'One claw calls across the pool. A curious neighbour answers; the shy one watches.'],
    return: ['Back to the rocks', 'The excitement settles. Familiar shelters welcome their residents home.']
  },
  signals: {
    arrive: ['The council gathers', 'Different instincts arrive at the same pool. There is room for a little negotiation.'],
    signal: ['A call, then an answer', 'Watch the claws: one resident makes the first move, and the others reply in their own time.'],
    challenge: ['Who owns this patch?', 'The territorial crab stands its ground. Curiosity inches closer; caution keeps its distance.'],
    return: ['A graceful retreat', 'Claws lower and the gathering disperses. Peace returns, one sideways step at a time.']
  },
  tide: {
    forage: ['Before the wash', 'There is still time for one more morsel. The current carries a hint of what comes next.'],
    retreat: ['Here comes the water', 'Feet brace against the wash. Each crab turns toward the shelter it knows.'],
    shelter: ['Wait it out', 'Stay low. Peek carefully. The brave and the cautious keep very different clocks.'],
    return: ['The first brave steps', 'The wash recedes. A curious resident ventures out; the others follow when they are ready.']
  },
  study: { arrive: ['A quiet study', 'A single shell, two claws and a sideways sense of purpose.'] }
};
const activities = {
  rest: 'Taking a quiet moment', scuttle: 'Scuttling across the sand', forage: 'Sifting for a morsel',
  signal: 'Sending a claw signal', retreat: 'Heading for familiar cover', shelter: 'Peeking from shelter',
  return: 'Finding the way back', inspect: 'Investigating the visitor', groom: 'Tidying claws and eyes', brace: 'Bracing against the wash'
};
const motives = {
  curious: 'Curious by nature. Always the first to investigate.',
  shy: 'A careful observer. A familiar rock is never far away.',
  territorial: 'A proud little neighbour. This patch of sand matters.'
};
const number = id => String(id + 1).padStart(2, '0');
const currentLabel = current => Math.abs(current) < .025 ? 'Still water' : `${current < 0 ? '←' : '→'} ${Math.round(Math.abs(current) * 100)}%`;

function start() {
  let art;
  const canvas = $('animal');
  const gridForWidth = width => width < 560 ? { columns: 80, rows: 32 }
    : width < 780 ? { columns: 112, rows: 45 } : { columns: 140, rows: 56 };
  try {
    art = createCrabArtwork(canvas, {
      ...presets.forage, count: 1, ...gridForWidth(canvas.getBoundingClientRect().width), labels: false,
      director: 'auto', actDuration: 240,
      cast: [
        { label: 'Pip', role: 'curious', size: 1 },
        { label: 'Moss', role: 'shy', size: .88 },
        { label: 'Brine', role: 'territorial', size: 1.12 },
        { label: 'Dot', role: 'curious', size: .84 },
        { label: 'Flint', role: 'territorial', size: 1.04 }
      ]
    });
  } catch (error) {
    $('stage-error').hidden = false;
    $('stage-error').textContent = 'The tidepool could not start in this browser. It needs a working Canvas 2D context. The source and typed API are available through “View source”.';
    $('animal').hidden = true;
    for (const control of document.querySelectorAll('main button, main input, main select')) control.disabled = true;
    console.error('Crab theatre could not mount:', error);
    return;
  }

  const events = new AbortController();
  const on = (element, name, listener) => element.addEventListener(name, listener, { signal: events.signal });
  const castNodes = new Map();
  let castEvents = new AbortController(), chapterEvents = new AbortController();
  let castSignature = '', chapterSignature = '', disposed = false, retainedUrl = null;
  let cachedPlayback = null, capturedFrame = null;
  // The specimen keeps a readable glyph size on phones. Only a breakpoint
  // change reseats feet; ordinary CSS resizing remains the adapter's job.
  const resizeGrid = () => {
    if (disposed) return;
    const grid = gridForWidth(canvas.getBoundingClientRect().width);
    if (grid.columns !== art.getOptions().columns) art.update(grid);
  };
  const gridObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resizeGrid) : null;
  gridObserver?.observe(canvas);
  if (!gridObserver) on(window, 'resize', resizeGrid);
  const announce = text => { $('announcement').textContent = text; };
  const actorFor = scene => scene.actors.find(actor => actor.id === scene.selectedId) ?? scene.actors[0];

  function renderCast(scene) {
    const signature = scene.actors.map(actor => `${actor.id}:${actor.label}`).join('|');
    if (signature !== castSignature) {
      castSignature = signature;
      castEvents.abort(); castEvents = new AbortController();
      castNodes.clear();
      const fragment = document.createDocumentFragment();
      for (const actor of scene.actors) {
        const card = document.createElement('article');
        card.className = 'cast-card';
        const select = document.createElement('button');
        select.type = 'button'; select.className = 'cast-select';
        select.setAttribute('aria-label', `Select resident ${number(actor.id)} ${actor.label}`);
        const serial = document.createElement('span'); serial.className = 'cast-number'; serial.textContent = number(actor.id);
        const name = document.createElement('span'); name.textContent = actor.label;
        const indicator = document.createElement('span'); indicator.className = 'cast-indicator'; indicator.setAttribute('aria-hidden', 'true');
        select.append(serial, name, indicator);
        select.addEventListener('click', () => { art.select(actor.id); announce(`${actor.label} is selected. Use Forage, Signal or Shelter to direct it.`); }, { signal: castEvents.signal });
        const label = document.createElement('label'); label.htmlFor = `role-${actor.id}`; label.textContent = `${actor.label}’s instinct`;
        const role = document.createElement('select'); role.id = `role-${actor.id}`;
        for (const value of ['curious', 'shy', 'territorial']) {
          const option = document.createElement('option'); option.value = value; option.textContent = value[0].toUpperCase() + value.slice(1); role.append(option);
        }
        role.addEventListener('change', () => {
          const cast = [...art.getOptions().cast];
          cast[actor.id] = { ...cast[actor.id], label: actor.label, role: role.value, size: art.getScene().actors.find(resident => resident.id === actor.id).size };
          art.update({ cast });
          announce(`${actor.label} now has a ${role.value} instinct.`);
        }, { signal: castEvents.signal });
        const state = document.createElement('p'); state.className = 'cast-state'; state.setAttribute('aria-live', 'off');
        card.append(select, label, role, state); fragment.append(card);
        castNodes.set(actor.id, { card, select, role, state });
      }
      $('cast').replaceChildren(fragment);
    }
    for (const actor of scene.actors) {
      const node = castNodes.get(actor.id);
      node.card.dataset.role = actor.role;
      node.card.classList.toggle('selected', actor.id === scene.selectedId);
      node.select.setAttribute('aria-pressed', String(actor.id === scene.selectedId));
      node.role.value = actor.role;
      node.state.textContent = activities[actor.behavior.kind] ?? actor.behavior.kind;
    }
  }

  function renderChapters(scene) {
    const signature = `${scene.scene}:${scene.beats.join(',')}`;
    if (signature !== chapterSignature) {
      chapterSignature = signature;
      chapterEvents.abort(); chapterEvents = new AbortController();
      const fragment = document.createDocumentFragment();
      scene.beats.forEach((beat, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'chapter'; button.dataset.beat = beat;
        const serial = document.createElement('span'); serial.className = 'chapter-number'; serial.textContent = number(index);
        const title = document.createElement('span'); title.textContent = stories[scene.scene]?.[beat]?.[0] ?? beat;
        button.append(serial, title);
        button.addEventListener('click', () => {
          art.setBeat(beat);
          announce(`${stories[scene.scene]?.[beat]?.[0] ?? beat}. ${art.getStatus().paused ? 'Showing a still moment.' : 'The scene continues.'}`);
        }, { signal: chapterEvents.signal });
        fragment.append(button);
      });
      $('chapters').replaceChildren(fragment);
    }
    for (const [index, button] of [...$('chapters').children].entries()) {
      if (index === scene.beatIndex) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      button.style.setProperty('--progress', `${index < scene.beatIndex ? 100 : index === scene.beatIndex ? Math.round(scene.progress * 100) : 0}%`);
    }
  }

  function sync() {
    if (disposed) return;
    const status = art.getStatus(), options = art.getOptions(), scene = art.getScene(), selected = actorFor(scene);
    const story = stories[scene.scene]?.[scene.beat] ?? [scene.beat, 'A small world, between the rocks.'];
    $('status').textContent = `${status.paused ? 'STILL' : 'LIVE'} / ${scene.actors.length} ${scene.actors.length === 1 ? 'RESIDENT' : 'RESIDENTS'}`;
    $('live-dot').classList.toggle('still', status.paused);
    $('water-status').textContent = `CURRENT ${currentLabel(scene.current).toUpperCase()}`;
    $('pause').disabled = status.reducedMotion;
    $('pause').textContent = status.reducedMotion ? 'Motion reduced' : options.paused ? 'Play' : 'Pause';
    $('pause').setAttribute('aria-label', status.reducedMotion ? 'Animation is still because reduced motion is enabled' : options.paused ? 'Play animation' : 'Pause animation');
    $('chapter-number').textContent = `ACT ${number(scene.beatIndex)} / ${String(scene.beats.length).padStart(2, '0')}`;
    $('chapter-title').textContent = story[0]; $('chapter-description').textContent = story[1];
    for (const card of document.querySelectorAll('[data-scene]')) card.setAttribute('aria-pressed', String(card.dataset.scene === scene.scene));
    $('hold').checked = options.director === 'manual';
    $('count').value = String(options.count); $('count-value').textContent = `${options.count} / 5`;
    $('formation').value = options.formation;
    $('current').value = String(options.current); $('current-value').textContent = currentLabel(options.current);
    $('act-duration').value = String(options.actDuration); $('act-duration-value').textContent = `${options.actDuration / 60} s`;
    for (const key of ['speed', 'scale']) { $(key).value = String(options[key]); $(`${key}-value`).textContent = `${options[key].toFixed(2)}×`; }
    $('tide').value = String(options.tide); $('tide-value').textContent = `${Math.round(options.tide * 100)}%`;
    $('palette').value = options.palette; $('facing').value = options.facing; $('labels').checked = options.labels;
    if (selected) {
      $('selected-name').textContent = `${number(selected.id)} / ${selected.label}`;
      $('selected-motive').textContent = motives[selected.role];
      $('selected-state').textContent = activities[selected.behavior.kind] ?? selected.behavior.kind;
      for (const [id, verb] of [['forage', 'Forage with'], ['greet', 'Signal with'], ['shelter', 'Shelter']]) {
        $(id).setAttribute('aria-label', `${verb} ${selected.label}`);
      }
    }
    $('motion-note').textContent = status.reducedMotion
      ? 'Reduced motion: a still tidepool. Choose a chapter or cue a resident to compose another moment. Playback stays still.'
      : options.paused
        ? 'Your tidepool is paused. Chapters and resident cues compose new still moments without starting playback.'
        : 'Pause whenever you like. Restart keeps your settings, and moving the guide never starts playback.';
    renderChapters(scene); renderCast(scene);
  }

  for (const card of document.querySelectorAll('[data-scene]')) on(card, 'click', () => {
    art.update(presets[card.dataset.scene]);
    announce(`${card.querySelector('.scene-name').textContent} Scene selected. Your cast and playback preference are preserved.`);
  });
  on($('pause'), 'click', () => { art.getOptions().paused ? art.play() : art.pause(); announce(art.getStatus().paused ? 'The tidepool is paused.' : 'The tidepool is playing.'); });
  on($('reset'), 'click', () => { art.restart(); announce('The scene has restarted. Your settings and playback preference are preserved.'); });
  on($('next-beat'), 'click', () => { art.nextBeat(); const scene = art.getScene(); announce(`Next moment: ${stories[scene.scene]?.[scene.beat]?.[0] ?? scene.beat}.`); });
  on($('hold'), 'change', () => {
    art.update({ director: $('hold').checked ? 'manual' : 'auto' });
    announce($('hold').checked
      ? art.getStatus().paused ? 'This chapter is held as a still moment. Resident cues remain available.' : 'This chapter is held. Its residents keep their own small routines.'
      : art.getStatus().paused ? 'Automatic direction is selected. The tidepool remains paused.' : 'The director will continue through the chapters.');
  });
  for (const [id, action] of [['forage', 'forage'], ['greet', 'signal'], ['shelter', 'shelter']]) on($(id), 'click', () => {
    const actor = actorFor(art.getScene()); art.cue(action);
    announce(`${actor?.label ?? 'The selected crab'}: ${action === 'signal' ? 'send a claw call' : action === 'forage' ? 'investigate the sand' : 'head for cover'}.`);
  });
  for (const [id, key] of [['count', 'count'], ['current', 'current'], ['act-duration', 'actDuration'], ['speed', 'speed'], ['scale', 'scale'], ['tide', 'tide']]) {
    on($(id), 'input', () => art.update({ [key]: Number($(id).value) }));
  }
  for (const key of ['formation', 'palette', 'facing']) on($(key), 'change', () => art.update({ [key]: $(key).value }));
  on($('labels'), 'change', () => art.update({ labels: $('labels').checked }));
  for (const [id, x] of [['left', -.65], ['right', .65]]) on($(id), 'click', () => {
    art.guide(x, .25);
    announce(`The guide is on the ${id}. ${art.getStatus().paused ? 'Choose Forage to compose a still response.' : 'Nearby crabs respond according to their instincts.'}`);
  });
  on($('center'), 'click', () => { art.clearGuide(); announce('The guide is cleared. The residents return to their own business.'); });
  on($('animal'), 'pointerdown', event => {
    if (event.isPrimary === false) return;
    const selected = actorFor(art.getScene());
    if (selected) announce(`${selected.label} is selected. ${motives[selected.role]}`);
  });
  on($('animal'), 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase(), scene = art.getScene(), selected = actorFor(scene);
    if (/^[1-5]$/.test(key) && Number(key) <= scene.actors.length) announce(`${selected.label} is selected. ${motives[selected.role]}`);
    else if (key === ' ') announce(art.getStatus().reducedMotion ? 'Reduced motion keeps the tidepool still.' : art.getOptions().paused ? 'The tidepool is paused.' : 'The tidepool is playing.');
    else if (key === 'escape') announce('The guide is cleared.');
    else if (key === 'n') announce(`Next moment: ${stories[scene.scene]?.[scene.beat]?.[0] ?? scene.beat}.`);
    else if (['f', 's', 'h'].includes(key)) announce(`${selected?.label ?? 'The selected crab'}: ${key === 'f' ? 'investigate the sand' : key === 's' ? 'send a claw call' : 'head for cover'}.`);
  });

  function download(blob, filename) {
    if (disposed) return;
    if (retainedUrl) URL.revokeObjectURL(retainedUrl);
    retainedUrl = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = retainedUrl; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    // At most one URL is retained; it is revoked by the next export or disposal.
  }
  on($('capture'), 'click', () => {
    capturedFrame = { text: art.getFrame().text, scene: art.getScene().scene, tick: art.getStatus().tick };
    $('text-frame').textContent = capturedFrame.text;
    $('capture-note').textContent = `Captured “${$('chapter-title').textContent}”. “Save snapshot .txt” saves these exact characters; the PNG button captures the current canvas.`;
    $('download-text').textContent = 'Save snapshot .txt ↓';
    $('capture-region').hidden = false; $('capture').setAttribute('aria-expanded', 'true');
    $('text-frame').focus({ preventScroll: true });
    $('capture-region').scrollIntoView({ block: 'nearest', behavior: 'instant' });
    announce('A still ASCII frame is ready to read, select or save.');
  });
  on($('close-capture'), 'click', () => {
    $('capture-region').hidden = true; $('capture').setAttribute('aria-expanded', 'false');
    capturedFrame = null; $('download-text').textContent = 'Save .txt ↓';
    $('capture').focus({ preventScroll: true });
  });
  on($('download-text'), 'click', () => {
    const frame = capturedFrame ?? { text: art.getFrame().text, scene: art.getScene().scene, tick: art.getStatus().tick };
    download(new Blob([frame.text, '\n'], { type: 'text/plain;charset=utf-8' }), `crab-${frame.scene}-${frame.tick}.txt`);
    announce(capturedFrame ? 'The displayed ASCII snapshot has been prepared for download.' : 'The current ASCII frame has been prepared for download.');
  });
  on($('download-image'), 'click', () => {
    const sceneName = art.getScene().scene;
    $('animal').toBlob(blob => {
      if (disposed) return;
      if (!blob) { announce('This browser could not export the image. The ASCII frame is still available.'); return; }
      download(blob, `crab-${sceneName}.png`); announce('The current tidepool image has been prepared for download.');
    }, 'image/png');
  });

  const unsubscribe = art.subscribe(sync);
  function dispose() {
    if (disposed) return;
    disposed = true; unsubscribe(); gridObserver?.disconnect(); events.abort(); castEvents.abort(); chapterEvents.abort(); art.dispose();
    if (retainedUrl) { URL.revokeObjectURL(retainedUrl); retainedUrl = null; }
  }
  on(window, 'pagehide', event => {
    if (event.persisted) {
      if (cachedPlayback === null) cachedPlayback = !art.getOptions().paused;
      art.pause();
    }
    else dispose();
  });
  on(window, 'pageshow', event => {
    if (!event.persisted || disposed) return;
    const resume = cachedPlayback; cachedPlayback = null;
    if (resume) art.play();
  });
  sync();
}

start();
