/* Marine director controls. All animal pixels and scheduling belong to the
 * canonical CuttlefishArtwork engine. This page owns only its UI lifecycle. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('animal-canvas');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const names = { manta: 'Manta ray', octopus: 'Octopus', cuttlefish: 'Cuttlefish' };
  const motives = { auto: 'Scene choice', guide: 'Guide', forager: 'Forager', sentinel: 'Sentinel', companion: 'Companion' };
  const behaviors = { auto: 'Scene choice', cruise: 'Pass through', hover: 'Hold station', orbit: 'Orbit', curious: 'Curious', encounter: 'Meet the lens' };
  const chapters = ['arrive', 'engage', 'explore', 'depart'];
  const presets = {
    'reef-rendezvous': { title: 'Reef rendezvous', cast: ['manta', 'octopus', 'cuttlefish'], roles: ['guide', 'forager', 'sentinel'], size: .8, variation: .2,
      duration: 40, current: .35, spread: 1, intimacy: 1, autonomy: 1,
      description: 'Staggered arrivals, a shared encounter, a little exploration, then room for the next visitors.' },
    'upwelling-ballet': { title: 'Upwelling ballet', cast: ['manta', 'manta', 'manta', 'cuttlefish', 'octopus'], roles: ['guide', 'companion', 'guide', 'sentinel', 'forager'], size: .65, variation: .25,
      duration: 44, current: .65, spread: 1.15, intimacy: .75, autonomy: 1.2,
      description: 'Mantas bank through layered gliding passes while their companions keep quieter stations below.' },
    'tidepool-investigation': { title: 'Tidepool investigation', cast: ['octopus', 'cuttlefish', 'octopus'], roles: ['forager', 'sentinel', 'companion'], size: .8, variation: .18,
      duration: 48, current: .15, spread: 1, intimacy: 1.25, autonomy: 1,
      description: 'Arms lead the search. A held invitation gives the visitors something to inspect and a reason to return.' }
  };
  const baseOptions = () => ({ scene: 'reactive', species: 'manta', speciesByAnimal: [], seed: 20261118,
    count: 3, behaviors: ['auto', 'auto', 'auto'], formation: 'independent', size: .8, sizeVariation: .2,
    spacing: 1, density: 1.2, ripple: 1.3, speed: 1, motion: 1.2, depthStrength: 1.2,
    palette: 'lagoon', mode: 'ascii', glow: true, followPointer: true, showLabels: false, reverse: false });
  const requestedSpecies = new URLSearchParams(window.location.search).get('species');
  const solo = Object.hasOwn(names, requestedSpecies) ? requestedSpecies : null;
  let scene = solo === 'manta' ? 'upwelling-ballet' : solo === 'octopus' ? 'tidepool-investigation' : 'reef-rendezvous';
  let classic = false, settings = baseOptions(), director = {}, cast = [], legacyRoles = [];
  let renderer = null, interval = null, removers = [], savedPaused, mounted = false, generation = 0;
  let downloadURL = null, beacon = { x: .12, y: .12 }, stillChapter = null;
  const optionRanges = ['size', 'sizeVariation', 'speed', 'motion', 'ripple', 'density', 'depthStrength', 'spacing'];
  const directorRanges = ['current', 'duration', 'autonomy', 'intimacy', 'spread'];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  }
  function announce(message, error = false) {
    $('action-status').textContent = message;
    $('action-status').classList.toggle('error', error);
  }
  function guard(action) {
    try { syncDirectorInput(); action(); } catch (error) { announce('That change could not be applied. ' + error.message, true); }
  }
  function syncDirectorInput(snapshot) {
    if (!renderer || !mounted || classic) return;
    const view = snapshot || renderer.getDirector();
    // A canvas tap can change focus or invitation between UI telemetry ticks.
    // Read it before each action, without changing native form values that
    // the pending action still needs to read (especially the focus select).
    if (Number.isInteger(view.focused) && view.focused >= 1 && view.focused <= cast.length) director.focus = view.focused;
    if (view.cue?.active && Number.isFinite(view.cue.x) && Number.isFinite(view.cue.y)) beacon = { x: view.cue.x, y: view.cue.y };
  }
  function scoreFor(id, single = null) {
    const preset = presets[id];
    scene = id; classic = false;
    cast = single ? [single] : preset.cast.slice();
    legacyRoles = cast.map(() => 'auto');
    director = { scene: id, duration: preset.duration, current: preset.current, spread: preset.spread,
      intimacy: preset.intimacy, autonomy: preset.autonomy, focus: 1,
      roles: single ? [single === 'manta' ? 'guide' : single === 'octopus' ? 'forager' : 'sentinel'] : preset.roles.slice(), backdrop: true };
    settings = { ...settings, scene: 'reactive', formation: 'independent', reverse: false,
      size: single ? 1.05 : preset.size, sizeVariation: single ? 0 : preset.variation, spacing: 1 };
  }
  scoreFor(scene, solo);

  function artworkOptions() {
    return { ...settings, count: cast.length, species: cast[0], speciesByAnimal: cast.slice(), behaviors: legacyRoles.slice() };
  }
  function applyArtwork(patch = {}) {
    Object.assign(settings, patch);
    renderer.setOptions(artworkOptions());
    refreshControls(); refreshTelemetry();
  }
  function applyDirector(patch = {}) {
    const next = { ...director, ...patch, roles: [...(patch.roles || director.roles)] };
    if (!classic) renderer.setDirector(next);
    director = next;
    refreshControls(); refreshTelemetry();
  }
  function chooseScene(id, preserveSolo = false) {
    if (!Object.hasOwn(presets, id)) return;
    scoreFor(id, preserveSolo && cast.length === 1 ? cast[0] : null);
    stillChapter = null;
    renderer.setOptions(artworkOptions()); renderer.setDirector(director); renderer.restart();
    if (renderer.getStats().paused) { renderer.showDirectorStill('engage'); stillChapter = 'engage'; }
    renderCast(); refreshControls(); refreshTelemetry();
    announce(presets[id].title + '. ' + presets[id].description);
  }
  function chooseClassic() {
    classic = true; stillChapter = null; renderer.setDirector(null);
    renderer.setOptions(artworkOptions());
    renderCast(); refreshControls(); refreshTelemetry();
    announce('Classic current. Choose an original scene, formation, and individual role.');
  }
  function setCount(count) {
    if (!Number.isInteger(count) || count < 1 || count > (classic ? 12 : 8)) return;
    const source = presets[scene].cast;
    cast = Array.from({ length: count }, (_, i) => cast[i] || source[i % source.length]);
    legacyRoles = Array.from({ length: count }, (_, i) => legacyRoles[i] || 'auto');
    director.roles = Array.from({ length: count }, (_, i) => director.roles[i] || 'auto');
    director.focus = Math.min(count, director.focus);
    renderer.setOptions(artworkOptions()); if (!classic) renderer.setDirector(director);
    renderCast(); refreshControls(); refreshTelemetry();
  }
  function createSelect(id, options, value, field, member) {
    const select = document.createElement('select'); select.id = id;
    select.dataset.field = field; select.dataset.member = String(member);
    for (const [key, label] of Object.entries(options)) {
      const option = document.createElement('option'); option.value = key; option.textContent = label; select.appendChild(option);
    }
    select.value = value;
    return select;
  }
  function renderCast() {
    const rows = $('cast-rows'); rows.replaceChildren();
    const focus = $('focus'); focus.replaceChildren();
    cast.forEach((species, i) => {
      const row = document.createElement('div'); row.className = 'cast-row'; row.id = 'member-' + i;
      const number = document.createElement('span'); number.className = 'member-number'; number.textContent = String(i + 1).padStart(2, '0'); row.appendChild(number);
      for (const field of ['species', 'role']) {
        const label = document.createElement('label'); label.textContent = field === 'species' ? 'Visitor' : classic ? 'Original role' : 'Motive';
        const select = createSelect(field + '-' + i, field === 'species' ? names : classic ? behaviors : motives,
          field === 'species' ? species : classic ? legacyRoles[i] : director.roles[i], field, i);
        label.htmlFor = select.id; label.appendChild(select); row.appendChild(label);
      }
      const motive = document.createElement('span'); motive.className = 'member-motive'; motive.id = 'motive-' + i;
      motive.textContent = 'Finding a place in the current'; row.appendChild(motive); rows.appendChild(row);
      const option = document.createElement('option'); option.value = String(i + 1); option.textContent = String(i + 1).padStart(2, '0') + ' · ' + names[species]; focus.appendChild(option);
    });
    focus.value = String(director.focus);
  }
  function format(key, value) {
    if (key === 'count') return String(value);
    if (key === 'duration') return value + ' s';
    if (key === 'current') return (value > 0 ? '+' : '') + Math.round(value * 100) + '%';
    if (['size', 'sizeVariation', 'autonomy', 'intimacy'].includes(key)) return Math.round(value * 100) + '%';
    return value.toFixed(2) + '×';
  }
  function refreshControls() {
    const title = classic ? 'Classic current' : presets[scene].title;
    $('animal-title').textContent = title;
    $('specimen-index').textContent = cast.length === 1 ? { cuttlefish: '01', manta: '02', octopus: '03' }[cast[0]] : '01—03';
    $('classic-mode').setAttribute('aria-pressed', String(classic));
    $('director-controls').hidden = classic; $('classic-controls').hidden = !classic;
    $('chapter-strip').hidden = classic; $('still-controls').hidden = classic;
    $('keyboard-director').hidden = classic; $('keyboard-classic').hidden = !classic;
    $('spread-row').hidden = classic; $('backdrop-row').hidden = classic;
    $('invite').disabled = classic; $('release').disabled = classic;
    $('legacy-scene').value = settings.scene; $('formation').value = settings.formation;
    $('render-mode').value = settings.mode; $('focus').value = String(director.focus);
    $('count').max = String(classic ? 12 : 8);
    $('cast-summary').textContent = cast.length + (cast.length === 1 ? ' visitor' : ' visitors');
    $('cast-help').textContent = classic
      ? 'Independent formation honors each original role. Other paths choreograph the group. Up to twelve visitors are available.'
      : 'Each visitor keeps its motive when you adjust the scene. Three to five leave room for readable encounters.';
    $('stage-help').textContent = classic
      ? 'Explore the original scene and formation tools. Gentle movement invites curiosity; click a visible animal for its response.'
      : 'Move gently to invite curiosity. Tap empty water to leave a point of interest; tap a visitor for its own response.';
    $('medium-label').textContent = settings.mode === 'points' ? 'PARTICLES / SHARED WATER' : 'CHARACTERS / SHARED WATER';
    $('follow-pointer').checked = settings.followPointer;
    for (const key of ['reverse', 'showLabels', 'glow']) $(key).checked = settings[key];
    $('backdrop').checked = director.backdrop;
    document.body.dataset.palette = settings.palette;
    document.querySelectorAll('[data-scene]').forEach(button => {
      const selected = !classic && button.dataset.scene === scene;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-palette]').forEach(button => {
      const selected = button.dataset.palette === settings.palette;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    for (const key of ['count', ...optionRanges, ...directorRanges]) {
      const input = $(key), value = key === 'count' ? cast.length : directorRanges.includes(key) ? director[key] : settings[key];
      input.value = String(value); $(key + '-value').textContent = format(key, value);
      input.style.setProperty('--fill', ((value - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    }
    canvas.setAttribute('aria-label', `${title}. ${cast.length} procedural ASCII marine ${cast.length === 1 ? 'visitor' : 'visitors'}: ${cast.map(id => names[id]).join(', ')}. Use the director controls for focus, invitations, reactions, and still chapters.`);
  }
  function refreshTelemetry() {
    if (!renderer || !mounted) return;
    const stats = renderer.getStats(), paused = stats.paused;
    const view = renderer.getDirector() || {};
    syncDirectorInput(view); $('focus').value = String(director.focus);
    if (!paused) stillChapter = null;
    $('play-text').textContent = paused ? 'Play' : 'Pause'; $('play-symbol').textContent = paused ? '▷' : 'Ⅱ';
    $('play-pause').setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    $('playback-label').textContent = paused ? 'STILL' : document.hidden ? 'RESTING' : 'LIVE';
    $('live-dot').classList.toggle('paused', paused || document.hidden);
    $('react').disabled = paused;
    $('react').title = paused ? 'Press Play before inviting a startle.' : classic ? 'An available visitor responds; a swim-by replays its passage.' : 'The focused animal reacts in its own way.';
    $('react').textContent = classic ? settings.scene === 'swimby' ? 'Replay passage' : 'Invite a response' : 'Startle focus';
    $('view-count').textContent = `${stats.visibleCount} IN VIEW / ${stats.count} VISITORS`;
    $('render-stats').textContent = `${Number(stats.glyphs || 0).toLocaleString()} ${settings.mode === 'points' ? 'POINTS' : 'GLYPHS'} · ${paused ? 'STILL' : Math.round(stats.fps || 0) + ' FPS'}`;
    const focusIndex = director.focus - 1, fish = stats.fish?.[focusIndex], member = view.members?.[focusIndex];
    $('focus-badge').textContent = 'FOCUS ' + String(director.focus).padStart(2, '0') + ' / ' + names[cast[focusIndex]].toUpperCase();
    const motive = member?.motive || fish?.phase || 'Finding the current';
    $('focus-note').textContent = names[cast[focusIndex]] + ' · ' + (classic ? behaviors[legacyRoles[focusIndex]] : motives[member?.role || director.roles[focusIndex]]) + ' — ' + motive;
    $('phase-label').textContent = fish?.reactionStage !== 'idle' ? fish?.phase || motive : view.chapterLabel || motive;
    if (!classic) {
      const progress = Math.max(0, Math.min(1, Number(view.progress) || 0));
      $('chapter-name').textContent = view.chapterLabel || 'Meeting';
      $('chapter-time').textContent = String(Math.floor(Number(view.time) % director.duration || 0)).padStart(2, '0') + ' / ' + director.duration + ' s';
      $('chapter-progress').style.width = (progress * 100) + '%';
      document.querySelectorAll('[data-chapter]').forEach(label => label.classList.toggle('active', label.dataset.chapter === view.chapter));
    }
    document.querySelectorAll('[data-still]').forEach(button => button.setAttribute('aria-pressed', String(paused && stillChapter === button.dataset.still)));
    cast.forEach((_, i) => {
      $('member-' + i)?.classList.toggle('focused', i === focusIndex);
      const label = $('motive-' + i); if (label) label.textContent = view.members?.[i]?.motive || stats.fish?.[i]?.phase || 'Finding the current';
    });
    $('motion-note').hidden = !motionPreference.matches;
    $('motion-note').textContent = paused
      ? 'Reduced motion is on. Explore the four still chapters, or press Play to animate by choice.'
      : 'Playing by your choice with reduced motion enabled. Pause at any time; the still chapters remain available.';
  }
  function togglePause() {
    renderer.setPaused(!renderer.getStats().paused); refreshTelemetry();
    announce(renderer.getStats().paused ? 'The current is still. You can inspect a chapter without starting time.' : 'The scene is moving.');
  }
  function invite() {
    if (classic) return;
    renderer.cueDirector({ type: 'invite', x: beacon.x, y: beacon.y }); refreshTelemetry();
    announce('A point of interest is waiting. The visitors choose how to approach. Release clears it.');
  }
  function react() {
    if (renderer.getStats().paused) return;
    if (classic) {
      renderer.pulse(); refreshTelemetry();
      announce(settings.scene === 'swimby' ? 'The passage begins again.' : 'An available visitor responds to the disturbance.');
    } else {
      const reacted = renderer.cueDirector({ type: 'disturb', id: director.focus }); refreshTelemetry();
      announce(reacted ? names[cast[director.focus - 1]] + (cast[director.focus - 1] === 'manta' ? ' banks away without ink.' : ' gathers, releases ink, and retreats.') : 'This visitor is recovering. Give it a moment before another startle.');
    }
  }
  function release() {
    if (classic) return;
    renderer.cueDirector({ type: 'release' }); refreshTelemetry(); announce('The invitation is released. Let the visitors return to their own intentions.');
  }
  function showStill(chapter) {
    if (classic || !chapters.includes(chapter)) return;
    renderer.showDirectorStill(chapter); stillChapter = chapter; refreshTelemetry();
    announce('A still composition of ' + chapter + '. Press Play when you want time to move again.');
  }
  function download(blob, filename) {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = downloadURL; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  }
  function capture() {
    const captureGeneration = generation;
    canvas.toBlob(blob => {
      if (!mounted || captureGeneration !== generation) return;
      if (!blob) { announce('The frame could not be captured. Please try again.', true); return; }
      download(blob, `marine-${classic ? 'classic' : scene}-${settings.palette}.png`);
      announce('The actual canvas frame is ready as a PNG.');
    }, 'image/png');
  }
  function exportScore() {
    const state = renderer.getDirector();
    const score = { schema: 'ascii-animals/marine-director-score/v1', artwork: artworkOptions(), director: classic ? null : { ...director, roles: director.roles.slice() },
      observation: { paused: renderer.getStats().paused, chapter: state?.chapter || null, time: state?.time || 0 },
      note: 'Reusable configuration. Observation time is descriptive; this is not an ink replay file.' };
    download(new Blob([JSON.stringify(score, null, 2) + '\n'], { type: 'application/json' }), 'marine-scene-score.json');
    announce('The scene configuration is ready as JSON. It preserves the cast, motives, and drawing settings.');
  }
  function dispose() {
    if (!mounted) return;
    savedPaused = renderer ? renderer.getStats().paused : savedPaused;
    mounted = false; generation++;
    if (interval !== null) clearInterval(interval); interval = null;
    for (const remove of removers) remove(); removers = [];
    renderer?.destroy(); renderer = null;
    if (downloadURL) URL.revokeObjectURL(downloadURL); downloadURL = null;
  }
  function mount() {
    if (mounted) return;
    mounted = true; generation++;
    try {
      renderer = new window.CuttlefishArtwork(canvas, { ...artworkOptions(), paused: savedPaused, reducedMotion: 'system' });
      if (typeof renderer.setDirector !== 'function') throw new Error('Rebuild the canonical marine renderer.');
      renderer.setDirector(classic ? null : director);
      if (!classic && renderer.getStats().paused) { renderer.showDirectorStill(stillChapter || 'engage'); stillChapter ||= 'engage'; }
      $('canvas-frame').classList.remove('error');
      renderCast(); refreshControls(); refreshTelemetry();
      document.querySelectorAll('[data-scene]').forEach(button => listen(button, 'click', () => guard(() => chooseScene(button.dataset.scene))));
      document.querySelectorAll('[data-still]').forEach(button => listen(button, 'click', () => guard(() => showStill(button.dataset.still))));
      document.querySelectorAll('[data-palette]').forEach(button => listen(button, 'click', () => guard(() => applyArtwork({ palette: button.dataset.palette }))));
      listen($('classic-mode'), 'click', () => guard(chooseClassic));
      listen($('count'), 'input', event => guard(() => setCount(Number(event.target.value))));
      for (const key of optionRanges) listen($(key), 'input', event => guard(() => applyArtwork({ [key]: Number(event.target.value) })));
      for (const key of directorRanges) listen($(key), 'input', event => guard(() => applyDirector({ [key]: Number(event.target.value) })));
      for (const key of ['reverse', 'showLabels', 'glow']) listen($(key), 'change', event => guard(() => applyArtwork({ [key]: event.target.checked })));
      listen($('follow-pointer'), 'change', event => guard(() => applyArtwork({ followPointer: event.target.checked })));
      listen($('backdrop'), 'change', event => guard(() => applyDirector({ backdrop: event.target.checked })));
      listen($('render-mode'), 'change', event => guard(() => applyArtwork({ mode: event.target.value })));
      listen($('legacy-scene'), 'change', event => guard(() => applyArtwork({ scene: event.target.value })));
      listen($('formation'), 'change', event => guard(() => applyArtwork({ formation: event.target.value })));
      listen($('focus'), 'change', event => guard(() => applyDirector({ focus: Number(event.target.value) })));
      listen($('cast-rows'), 'change', event => guard(() => {
        const index = Number(event.target.dataset.member), field = event.target.dataset.field, value = event.target.value;
        if (!Number.isInteger(index) || index < 0 || index >= cast.length) return;
        if (field === 'species' && Object.hasOwn(names, value)) { cast[index] = value; applyArtwork(); renderCast(); refreshTelemetry(); }
        else if (field === 'role' && Object.hasOwn(classic ? behaviors : motives, value)) {
          if (classic) { legacyRoles[index] = value; applyArtwork(); }
          else { const roles = director.roles.slice(); roles[index] = value; applyDirector({ roles }); }
        }
      }));
      listen($('play-pause'), 'click', () => guard(togglePause));
      listen($('invite'), 'click', () => guard(invite)); listen($('react'), 'click', () => guard(react));
      listen($('release'), 'click', () => guard(release));
      listen($('replay'), 'click', () => guard(() => { renderer.restart(); stillChapter = null; refreshTelemetry(); announce('The arrival is reset. Playback state is preserved.'); }));
      listen($('reset'), 'click', () => guard(() => {
        const palette = settings.palette, mode = settings.mode;
        settings = { ...baseOptions(), palette, mode };
        if (classic) {
          legacyRoles = cast.map(() => 'auto'); renderer.setOptions(artworkOptions()); renderer.restart();
          renderCast(); refreshControls(); refreshTelemetry();
          announce('Classic settings are restored for this cast. Playback state is preserved.');
        } else {
          chooseScene(scene, Boolean(solo)); announce('This scene’s cast and score are restored. Playback state is preserved.');
        }
      }));
      listen($('save-png'), 'click', () => guard(capture)); listen($('save-score'), 'click', () => guard(exportScore));
      listen(canvas, 'keydown', event => {
        if (event.target !== canvas || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key, code = event.code;
        if (!(code === 'Space' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Enter', 'i', 'I', 'r', 'R'].includes(key) || /^[1-8]$/.test(key))) return;
        event.preventDefault();
        guard(() => {
          if (code === 'Space') togglePause();
          else if (key === 'Enter') react();
          else if (/^[1-8]$/.test(key)) { if (Number(key) <= cast.length) applyDirector({ focus: Number(key) }); }
          else if (key === 'r' || key === 'R') release();
          else if (!classic) {
            if (key === 'Home') beacon = { x: 0, y: 0 };
            else { beacon.x = Math.max(-.42, Math.min(.42, beacon.x + (key === 'ArrowLeft' ? -.06 : key === 'ArrowRight' ? .06 : 0)));
              beacon.y = Math.max(-.36, Math.min(.36, beacon.y + (key === 'ArrowUp' ? -.06 : key === 'ArrowDown' ? .06 : 0))); }
            invite();
          }
        });
      });
      listen(document, 'visibilitychange', refreshTelemetry);
      listen(motionPreference, 'change', refreshTelemetry);
      listen(window, 'pagehide', event => {
        dispose();
        if (event.persisted) window.addEventListener('pageshow', restored => { if (restored.persisted) mount(); }, { once: true });
      });
      const telemetryGeneration = generation;
      interval = setInterval(() => { if (telemetryGeneration === generation) refreshTelemetry(); }, 250);
    } catch (error) {
      dispose(); $('canvas-frame').classList.add('error'); $('playback-label').textContent = 'UNAVAILABLE';
      $('render-stats').textContent = 'ARTWORK COULD NOT START';
      for (const id of ['play-pause', 'invite', 'react', 'release', 'replay', 'reset', 'save-png', 'save-score']) $(id).disabled = true;
      announce('The marine artwork could not start. Rebuild artwork.js from the canonical source and keep the demo files together. ' + error.message, true);
    }
  }
  mount();
})();
