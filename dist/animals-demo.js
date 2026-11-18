/* Local review controls. All animal pixels come from CuttlefishArtwork. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('animal-canvas');
  const names = { manta: 'Manta ray', octopus: 'Octopus', cuttlefish: 'Cuttlefish', mixed: 'Marine company' };
  const descriptions = {
    manta: 'Move nearby to invite a turn. Click the animal to make it bank away.',
    octopus: 'Move nearby to invite a reach. Click the animal to make it gather its arms and retreat.',
    cuttlefish: 'Gentle movement invites curiosity. Click a visible animal for ink and escape.',
    mixed: 'Meet three silhouettes in a shared current. Click an animal to trigger its own response.'
  };
  const defaults = () => ({ scene: 'reactive', species: 'manta', speciesByAnimal: [], seed: 20261118,
    count: 1, behaviors: ['hover'], formation: 'independent', size: 1.1, sizeVariation: 0,
    spacing: 1, density: 1.2, ripple: 1.3, speed: 1.05, motion: 1.2, depthStrength: 1.2,
    palette: 'lagoon', mode: 'ascii', glow: true, followPointer: true, showLabels: false });
  let settings = defaults(), selection = 'manta', renderer = null;
  let interval = null, disposers = [], savedPaused = undefined, downloadURL = null, mounted = false, generation = 0;

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    disposers.push(() => target.removeEventListener(type, handler));
  }
  function announce(message, error = false) {
    $('action-status').textContent = message;
    $('action-status').classList.toggle('error', error);
  }
  function arrangeAnimals() {
    const count = settings.count;
    settings.species = selection === 'mixed' ? 'manta' : selection;
    settings.speciesByAnimal = selection === 'mixed'
      ? Array.from({ length: count }, (_, i) => ['manta', 'octopus', 'cuttlefish'][i % 3]) : [];
    settings.behaviors = Array.from({ length: count }, (_, i) => {
      const species = settings.speciesByAnimal[i] || settings.species;
      return species === 'cuttlefish' ? 'curious' : 'hover';
    });
  }
  function format(id, value) {
    return id === 'count' ? String(value) : id === 'size' ? Math.round(value * 100) + '%' : value.toFixed(2) + '×';
  }
  function refreshControls() {
    $('species').value = selection;
    $('formation').value = settings.formation;
    $('follow-pointer').checked = settings.followPointer;
    $('animal-title').textContent = names[selection];
    $('specimen-index').textContent = selection === 'manta' ? '02' : selection === 'octopus' ? '03' : selection === 'cuttlefish' ? '01' : '01—03';
    $('animal-description').textContent = descriptions[selection];
    const subject = selection === 'mixed' ? 'manta rays, octopuses, and cuttlefish' : names[selection].toLowerCase();
    canvas.setAttribute('aria-label', `${settings.count} procedural ASCII ${subject} in a ${settings.formation} current. ${descriptions[selection]} Use the Play or Pause, React, and Reset controls as keyboard alternatives.`);
    document.body.dataset.palette = settings.palette;
    document.querySelectorAll('button[data-palette]').forEach(button => {
      const selected = button.dataset.palette === settings.palette;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    for (const id of ['count', 'size', 'speed', 'ripple', 'density']) {
      const input = $(id), value = settings[id];
      input.value = String(value);
      $(id + '-value').textContent = format(id, value);
      input.style.setProperty('--fill', ((value - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    }
  }
  function refreshTelemetry() {
    if (!renderer || !mounted) return;
    const stats = renderer.getStats(), paused = stats.paused;
    $('play-text').textContent = paused ? 'Play' : 'Pause';
    $('play-symbol').textContent = paused ? '▷' : 'Ⅱ';
    $('play-pause').setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    $('playback-label').textContent = paused ? 'PAUSED' : document.hidden ? 'RESTING' : 'LIVE';
    $('live-dot').classList.toggle('paused', paused || document.hidden);
    $('react').disabled = paused;
    $('react').title = paused ? 'Press Play before inviting a reaction.' : 'Invite a response from a visible animal.';
    $('view-count').textContent = `${stats.visibleCount} IN VIEW / ${stats.count} IN THE CURRENT`;
    $('render-stats').textContent = `${Number(stats.glyphs || 0).toLocaleString()} GLYPHS · ${paused ? 'STILL' : Math.round(stats.fps || 0) + ' FPS'}`;
    const leader = stats.fish?.find(f => f.reactionStage !== 'idle') || stats.fish?.[0];
    $('phase-label').textContent = leader?.phase || stats.phase || 'In the current';
    $('motion-note').hidden = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('motion-note').textContent = paused
      ? 'Reduced motion is on. Press Play if you would like to animate.'
      : 'Playing by your choice. Pause at any time.';
  }
  function apply(patch) {
    if (!renderer) return;
    Object.assign(settings, patch);
    arrangeAnimals();
    // Changing a subject or a control never changes the current pause state.
    renderer.setOptions({ ...settings, speciesByAnimal: settings.speciesByAnimal.slice(), behaviors: settings.behaviors.slice() });
    refreshControls(); refreshTelemetry();
  }
  function chooseSpecies(value) {
    selection = value;
    if (value === 'mixed') {
      settings.count = 3; settings.size = .76; settings.sizeVariation = .35;
    }
    apply({});
    announce(names[value] + ', in the current.');
  }
  function togglePause() {
    if (!renderer) return;
    renderer.setPaused(!renderer.getStats().paused);
    refreshTelemetry();
    announce(renderer.getStats().paused ? 'The current is paused.' : 'The current is moving.');
  }
  function reset() {
    if (!renderer) return;
    settings = defaults();
    if (selection === 'mixed') { settings.count = 3; settings.size = .76; settings.sizeVariation = .35; }
    apply({}); renderer.restart(); refreshTelemetry();
    announce(names[selection] + ', from the beginning. Playback state is preserved.');
  }
  function capture() {
    if (!renderer) return;
    const captureGeneration = generation;
    // Capture the actual canvas frame; no illustration or second renderer.
    canvas.toBlob(blob => {
      if (!mounted || captureGeneration !== generation) return;
      if (!blob) { announce('The frame could not be captured. Please try again.', true); return; }
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadURL; link.download = `ascii-${selection}-${settings.palette}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      announce('The current frame is ready as a PNG.');
    }, 'image/png');
  }
  function dispose() {
    if (!mounted) return;
    savedPaused = renderer ? renderer.getStats().paused : savedPaused;
    mounted = false; generation++;
    if (interval !== null) clearInterval(interval);
    interval = null;
    for (const remove of disposers) remove();
    disposers = [];
    renderer?.destroy(); renderer = null;
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = null;
  }
  function mount() {
    if (mounted) return;
    mounted = true; generation++;
    try {
      arrangeAnimals();
      renderer = new window.CuttlefishArtwork(canvas, { ...settings, speciesByAnimal: settings.speciesByAnimal.slice(),
        behaviors: settings.behaviors.slice(), paused: savedPaused, reducedMotion: 'system' });
      $('canvas-frame').classList.remove('error');
      listen($('species'), 'change', event => chooseSpecies(event.target.value));
      listen($('formation'), 'change', event => apply({ formation: event.target.value }));
      listen($('follow-pointer'), 'change', event => apply({ followPointer: event.target.checked }));
      for (const id of ['count', 'size', 'speed', 'ripple', 'density']) {
        listen($(id), 'input', event => apply({ [id]: Number(event.target.value) }));
      }
      document.querySelectorAll('button[data-palette]').forEach(button => listen(button, 'click', () => apply({ palette: button.dataset.palette })));
      listen($('play-pause'), 'click', togglePause);
      listen($('react'), 'click', () => {
        if (renderer.getStats().paused) return;
        const started = renderer.pulse(); refreshTelemetry();
        announce(started ? 'Watch the animal respond, then settle.' : 'Let the current response finish, then invite another.');
      });
      listen($('reset'), 'click', reset);
      listen($('save-png'), 'click', capture);
      listen(document, 'keydown', event => {
        if (event.code !== 'Space' || event.repeat || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target.tagName) || event.target.isContentEditable) return;
        event.preventDefault(); togglePause();
      });
      listen(document, 'visibilitychange', refreshTelemetry);
      listen(window, 'pagehide', () => {
        dispose();
        // UI/input handlers and renderer are gone. This single-use restoration
        // listener is the only surviving lifecycle hook in the back/forward cache.
        window.addEventListener('pageshow', event => { if (event.persisted) mount(); }, { once: true });
      });
      refreshControls(); refreshTelemetry();
      interval = setInterval(refreshTelemetry, 250);
    } catch (error) {
      dispose();
      $('canvas-frame').classList.add('error');
      $('playback-label').textContent = 'UNAVAILABLE';
      $('render-stats').textContent = 'ARTWORK COULD NOT START';
      for (const id of ['play-pause', 'react', 'reset', 'save-png']) $(id).disabled = true;
      announce('The local artwork could not start. Keep the renderer, species modules, and demo files together, then reload.', true);
    }
  }
  mount();
})();
