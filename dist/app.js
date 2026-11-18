/* Cuttlefish — microsite controls. No framework, no network services. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const defaults = {scene:'swimby',palette:'lagoon',speed:1.05,ripple:1.3,density:1.1,motion:1.2,depthStrength:1.2,mode:'ascii',followPointer:false,glow:true,count:4,formation:'independent',size:.7,sizeVariation:.45,spacing:1,reverse:false,showLabels:false,behaviors:['auto','auto','auto','auto']};
  const formationNames = {independent:'Independent',horizontal:'Horizontal',vertical:'Vertical',diagonal:'Diagonal',random:'Random'};
  const roleNames = {auto:'Auto · follow scene',cruise:'Cruise',hover:'Hover',orbit:'Orbit',curious:'Curious',encounter:'Visit the lens'};
  const schoolPresets = {
    solo: {name:'Solo encounter',options:{scene:'encounter',count:1,formation:'independent',size:1,sizeVariation:0,spacing:1,reverse:false,behaviors:['auto']}},
    mixed: {name:'Mixed company',options:{count:4,formation:'independent',size:.7,sizeVariation:.45,spacing:1,reverse:false,behaviors:['auto','auto','auto','auto']}},
    horizontal: {name:'Horizontal procession',options:{scene:'swimby',count:6,formation:'horizontal',size:.55,sizeVariation:.2,spacing:1.05,reverse:false,behaviors:Array(6).fill('auto')}},
    diagonal: {name:'Diagonal drift',options:{scene:'swimby',count:5,formation:'diagonal',size:.6,sizeVariation:.35,spacing:1.2,reverse:false,behaviors:Array(5).fill('auto')}}
  };
  const scenes = {
    swimby: {
      name:'Swim-by',hint:'A quick arrival. A little time together.',phase:'Arriving',
      description:'An animated ASCII cuttlefish enters a fixed diver’s view quickly, lingers nearby with moving fins and arms, then swims away. Choose another scene or use the adjacent controls to explore.',
      action:'Invite a visit',note:'Replay its arrival, pause, and departure.'
    },
    encounter: {
      name:'Close encounter',hint:'Watch the arms crawl. Click for ink toward the lens.',phase:'Approaching',
      description:'An animated ASCII cuttlefish approaches the lens, centers its beak, and explores the view with independently crawling arms. Click or tap the artwork, or use Startle cuttlefish, to make it react, spray black ASCII ink toward the lens, then escape.',
      action:'Startle cuttlefish',note:'A warning. Ink toward the lens. Then escape.'
    },
    reactive: {
      name:'Startle & ink',hint:'Move repeatedly nearby, or click the cuttlefish.',phase:'Watching you',
      description:'An animated ASCII cuttlefish watches nearby mouse movement. Repeated disturbance nearby, a click or tap on the cuttlefish itself, or the Startle cuttlefish button makes it react, spray black ASCII ink toward the pointer, then dart away. Empty water does not respond to clicks.',
      action:'Startle cuttlefish',note:'Move repeatedly nearby, or tap the cuttlefish.'
    }
  };
  const state = {...defaults,behaviors:defaults.behaviors.slice()};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduceMotion.matches;
  let renderer;
  let toastTimer;
  let sourceText = '';
  const canvas = $('artwork');
  const scene = $('scene');
  const dialog = $('source-dialog');

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3100);
  }
  function updatePlayback() {
    renderer?.setPaused(paused);
    $('pause-btn').setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    $('pause-btn').title = (paused ? 'Play' : 'Pause') + ' animation (Space)';
    $('pause-btn').innerHTML = paused ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z"/></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
    $('live-label').textContent = paused ? 'PAUSED' : 'LIVE';
    $('status-dot').classList.toggle('paused', paused);
    refreshSceneHint();
    refreshTelemetry();
  }
  function refreshSceneHint() {
    let hint = scenes[state.scene].hint;
    if (state.formation !== 'independent') hint = 'A shared ' + formationNames[state.formation].toLowerCase() + ' current. Click a visitor for ink.';
    else if (state.count > 1) hint = state.scene === 'encounter'
      ? 'A visitor meets the lens. Its neighbors keep drifting.'
      : 'Different lives in the current. Click a visitor to startle it.';
    $('scene-hint').textContent = paused ? 'Still waters. Press play to animate.' : hint;
  }
  function refreshTelemetry() {
    if (!renderer) return;
    const stats = renderer.getStats();
    const glyphs = Number.isFinite(stats.glyphs) ? Math.round(stats.glyphs).toLocaleString() : '—';
    const fps = Number.isFinite(stats.fps) ? Math.round(stats.fps) : 0;
    $('stats').textContent = (paused ? 'STILL' : fps + ' FPS') + ' · ' + glyphs + (state.mode === 'ascii' ? ' GLYPHS' : ' POINTS');
    $('scene-phase').textContent = typeof stats.phase === 'string' && stats.phase ? stats.phase : scenes[state.scene].phase;
    const progress = Number.isFinite(stats.progress) ? Math.max(0, Math.min(1, stats.progress)) : 0;
    $('scene-progress').style.transform = 'scaleX(' + progress + ')';
    const agitation = Number.isFinite(stats.agitation) ? Math.max(0, Math.min(1, stats.agitation)) : 0;
    const stage = stats.reactionStage || 'idle';
    const stageLabels = {react:'Reacting',spray:'Spraying',escape:'Escaping',recover:'Settling'};
    const disturbance = stageLabels[stage] || (agitation < .18 ? 'Calm' : agitation < .65 ? 'Aware' : agitation < .9 ? 'Uneasy' : 'Alert');
    $('disturbance-state').textContent = disturbance;
    $('disturbance-fill').style.transform = 'scaleX(' + agitation + ')';
    $('disturbance-meter').setAttribute('aria-valuenow', String(Math.round(agitation * 100)));
    $('disturbance-meter').setAttribute('aria-valuetext', disturbance);
    $('disturbance').classList.toggle('alert', agitation > .65 || ['react','spray','escape'].includes(stage));
    const fish = Array.isArray(stats.fish) ? stats.fish : [];
    const activeStages = ['react','spray','escape','recover'];
    const reacting = state.scene !== 'swimby' && (fish.length
      ? fish.every(item => activeStages.includes(item.reactionStage))
      : activeStages.includes(stage));
    $('ink-btn').disabled = reacting;
    $('ink-btn').title = reacting ? 'Let the visitors finish their escape.' : scenes[state.scene].action;
    const population = Number.isFinite(stats.count) ? Math.round(stats.count) : state.count;
    const visible = Number.isFinite(stats.visibleCount) ? Math.round(stats.visibleCount) : fish.length ? fish.filter(item=>item.visible).length : null;
    $('school-live-count').textContent = population + ' IN SCHOOL' + (visible === null ? '' : ' · ' + visible + ' IN VIEW');
    for (let i = 0; i < state.count; i++) {
      const status = $('fish-status-' + i), card = $('fish-card-' + i), item = fish[i];
      if (!status || !card) continue;
      const phase = item && typeof item.phase === 'string' ? item.phase : 'Following the scene';
      const label = item && !item.visible ? 'Beyond the view' : phase;
      if (status.textContent !== label) status.textContent = label;
      status.title = phase;
      card.classList.toggle('in-view', Boolean(item?.visible));
    }
  }

  function refreshSchoolControls() {
    $('school-summary').textContent = state.count + ' in school · ' + formationNames[state.formation].toLowerCase();
    $('formation-name').textContent = formationNames[state.formation];
    $('school-director').classList.toggle('reversed', state.reverse);
    $('reverse').checked = state.reverse;
    $('showLabels').checked = state.showLabels;
    $('school-detail-summary').textContent = (state.sizeVariation > .05 ? 'Varied sizes' : 'Similar sizes') + ' · ' + (state.reverse ? 'reversed' : 'forward');
    for (const id of ['count','size','sizeVariation','spacing']) {
      const input = $(id), value = state[id];
      input.value = value;
      $(id + '-value').textContent = id === 'count' ? String(value) : id === 'spacing' ? value.toFixed(2) + '×' : Math.round(value * 100) + '%';
      input.style.setProperty('--fill', ((value - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    }
    document.querySelectorAll('[data-formation]').forEach(button => {
      const selected = button.dataset.formation === state.formation;
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-school-preset]').forEach(button => {
      const preset = schoolPresets[button.dataset.schoolPreset].options;
      const selected = Object.entries(preset).every(([key,value]) => Array.isArray(value)
        ? value.length === state.behaviors.length && value.every((role,i)=>role === state.behaviors[i])
        : typeof value === 'number' ? Math.abs(state[key] - value) < .001 : state[key] === value);
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    const roles = $('school-roles');
    if (roles.children.length !== state.count) {
      roles.replaceChildren();
      for (let i = 0; i < state.count; i++) {
        const card = document.createElement('div'); card.className = 'fish-role'; card.id = 'fish-card-' + i;
        const heading = document.createElement('div'); heading.className = 'fish-role-heading';
        const label = document.createElement('label'); label.htmlFor = 'fish-role-' + i; label.textContent = 'Cuttlefish ' + String(i + 1).padStart(2,'0');
        const dot = document.createElement('span'); dot.className = 'fish-presence'; dot.setAttribute('aria-hidden','true');
        heading.append(label,dot);
        const select = document.createElement('select'); select.id = 'fish-role-' + i; select.dataset.fishRole = i;
        for (const [value,name] of Object.entries(roleNames)) {
          const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option);
        }
        const status = document.createElement('span'); status.id = 'fish-status-' + i; status.className = 'fish-status'; status.setAttribute('aria-live','off'); status.textContent = 'Following the scene';
        card.append(heading,select,status); roles.append(card);
      }
    }
    for (let i = 0; i < state.count; i++) $('fish-role-' + i).value = state.behaviors[i] || 'auto';
    const independent = state.formation === 'independent';
    $('school-roles-fieldset').disabled = !independent;
    $('roles-help').textContent = independent ? 'Auto follows the scene. Give any visitor a different instinct.'
      : formationNames[state.formation] + ' formation directs every visitor. Choose Independent to use these individual roles.';
  }
  function formatSlider(id, value) {
    if (id === 'speed') return value.toFixed(2) + '×';
    const input = $(id);
    return Math.round((value - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%';
  }
  function refreshControls() {
    document.querySelectorAll('[data-scene]').forEach(button => {
      const selected = button.dataset.scene === state.scene;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('[data-palette]').forEach(button => {
      const selected = button.dataset.palette === state.palette;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('palette-name').textContent = state.palette.charAt(0).toUpperCase() + state.palette.slice(1);
    for (const id of ['speed','motion','depthStrength','ripple','density']) {
      const input = $(id);
      input.value = state[id];
      $(id+'-value').textContent = formatSlider(id, state[id]);
      input.style.setProperty('--fill', ((state[id] - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100) + '%');
    }
    const reactive = state.scene === 'reactive';
    $('follow').checked = reactive || state.followPointer;
    $('follow').disabled = reactive;
    $('follow-row').classList.toggle('inherent', reactive);
    $('follow-label').textContent = reactive ? 'Mouse-reactive' : 'Follow your cursor';
    $('follow-help').textContent = reactive ? 'Gentle movement keeps it calm.' : 'Invite a little curiosity.';
    $('disturbance').hidden = !reactive;
    $('ink-label').textContent = scenes[state.scene].action;
    const school = state.count > 1 || state.formation !== 'independent';
    $('ink-note').textContent = school ? (state.scene === 'swimby' ? 'Replay the school’s arrival and movement.' : 'Click a visitor for its own ink escape.') : scenes[state.scene].note;
    canvas.setAttribute('aria-label', school
      ? state.count + ' animated ASCII cuttlefish with ' + formationNames[state.formation].toLowerCase() + ' movement. Click or tap a visible visitor to make that animal react, spray black ASCII ink, then escape. Use School director to change the population, sizes, formation and individual roles.'
      : scenes[state.scene].description);
    $('render-label').textContent = state.mode === 'ascii' ? 'ASCII CANVAS' : 'PARTICLE CANVAS';
    refreshSceneHint();
    refreshSchoolControls();
  }
  function change(patch) {
    if (patch.behaviors) patch = {...patch,behaviors:patch.behaviors.slice()};
    Object.assign(state, patch);
    renderer?.setOptions(patch.behaviors ? {...patch,behaviors:patch.behaviors.slice()} : patch);
    if (Object.prototype.hasOwnProperty.call(patch, 'scene')) renderer?.setPaused(paused);
    refreshControls();
    refreshTelemetry();
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function downloadHTML() {
    try {
      if (document.documentElement.dataset.standalone === 'true') {
        const page = document.documentElement.cloneNode(true);
        page.querySelector('#source-dialog')?.removeAttribute('open');
        page.querySelector('#source-code').textContent = 'Loading the renderer…';
        page.querySelector('#toast')?.classList.remove('visible');
        page.querySelector('#scene')?.classList.remove('expanded');
        page.querySelector('body').style.overflow = '';
        const html = '<!doctype html>\n' + page.outerHTML;
        downloadBlob(new Blob([html], {type:'text/html'}), 'cuttlefish.html');
      } else {
        const response = await fetch('cuttlefish.html');
        if (!response.ok) throw new Error('The HTML download is unavailable.');
        downloadBlob(await response.blob(), 'cuttlefish.html');
      }
      toast('Your standalone HTML is ready to explore.');
    } catch (error) { toast('Could not download the HTML. Please try again.'); }
  }
  async function openSource() {
    dialog.showModal();
    if (sourceText) return;
    try {
      const embedded = document.querySelector('script[data-artwork-source]');
      if (embedded) sourceText = embedded.textContent;
      else {
        const response = await fetch('artwork.js');
        if (!response.ok) throw new Error('Source unavailable');
        sourceText = await response.text();
      }
      $('source-code').textContent = sourceText;
      $('source-size').textContent = (new Blob([sourceText]).size / 1024).toFixed(1) + ' KB';
    } catch (error) { $('source-code').textContent = 'The renderer source could not be loaded. Download the HTML below to inspect the complete code.'; }
  }
  document.querySelectorAll('.source-trigger').forEach(button => button.addEventListener('click', openSource));
  $('close-source').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  $('copy-source').addEventListener('click', async () => {
    if (!sourceText) return toast('The renderer is still loading.');
    try {
      await navigator.clipboard.writeText(sourceText);
      $('copy-source').textContent = 'Copied ✓';
      setTimeout(() => $('copy-source').textContent = 'Copy code', 1800);
    } catch (error) { toast('Copy is unavailable here. Use Download HTML to keep the code.'); }
  });
  document.querySelectorAll('.download-source, #download-btn').forEach(button => button.addEventListener('click', downloadHTML));
  document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
    if (state.scene !== button.dataset.scene) change({scene:button.dataset.scene});
  }));
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => change({mode:button.dataset.mode})));
  document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => change({palette:button.dataset.palette})));
  for (const id of ['speed','motion','depthStrength','ripple','density']) $(id).addEventListener('input', event => change({[id]:Number(event.target.value)}));
  for (const id of ['size','sizeVariation','spacing']) $(id).addEventListener('input', event => change({[id]:Number(event.target.value)}));
  $('count').addEventListener('input', event => {
    const count = Math.max(1,Math.min(12,Math.round(Number(event.target.value))));
    change({count,behaviors:Array.from({length:count},(_,i)=>state.behaviors[i] || 'auto')});
  });
  $('reverse').addEventListener('change', event => change({reverse:event.target.checked}));
  $('showLabels').addEventListener('change', event => change({showLabels:event.target.checked}));
  document.querySelectorAll('[data-formation]').forEach(button => button.addEventListener('click',()=>change({formation:button.dataset.formation})));
  document.querySelectorAll('[data-school-preset]').forEach(button => button.addEventListener('click',()=>{
    const preset = schoolPresets[button.dataset.schoolPreset];
    change({...preset.options,behaviors:preset.options.behaviors.slice()});
    toast(preset.name + ', ready to explore.');
  }));
  $('school-roles').addEventListener('change', event => {
    const index = Number(event.target.dataset.fishRole);
    if (state.formation !== 'independent' || !Number.isInteger(index) || index < 0 || index >= state.count || !Object.prototype.hasOwnProperty.call(roleNames,event.target.value)) return;
    const behaviors = state.behaviors.slice(); behaviors[index] = event.target.value;
    change({behaviors});
  });
  $('follow').addEventListener('change', event => {
    if (state.scene !== 'reactive') change({followPointer:event.target.checked});
  });
  $('pause-btn').addEventListener('click', () => { paused = !paused; updatePlayback(); });
  $('reset-btn').addEventListener('click', () => {
    const settings = {...defaults,behaviors:defaults.behaviors.slice()};
    delete settings.scene;
    change(settings);
    renderer?.restart();
    paused = paused || reduceMotion.matches;
    updatePlayback();
    refreshTelemetry();
    toast(scenes[state.scene].name + ', from the beginning.');
  });
  $('ink-btn').addEventListener('click', () => {
    if (paused && reduceMotion.matches) return toast('Press play to animate this scene.');
    if (paused) {paused = false; updatePlayback();}
    if (state.scene === 'swimby') renderer?.restart();
    else renderer?.pulse();
    refreshTelemetry();
    toast(state.scene === 'swimby' ? 'A new arrival in the current.' : 'Watch it react, spray, then escape.');
  });
  $('capture-btn').addEventListener('click', () => {
    canvas.toBlob(blob => {
      if (!blob) return toast('Could not capture this frame. Please try again.');
      downloadBlob(blob, 'cuttlefish-' + state.palette + '-' + Date.now() + '.png');
      toast('A moment in the current, captured.');
    }, 'image/png');
  });
  function updateFullscreen() {
    const expanded = document.fullscreenElement === scene || scene.classList.contains('expanded');
    $('fullscreen-btn').setAttribute('aria-label', expanded ? 'Exit fullscreen' : 'Enter fullscreen');
    $('fullscreen-btn').title = expanded ? 'Exit fullscreen (Esc)' : 'Enter fullscreen';
    renderer?.resize();
  }
  $('fullscreen-btn').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (scene.classList.contains('expanded')) {scene.classList.remove('expanded'); document.body.style.overflow='';}
      else if (scene.requestFullscreen) await scene.requestFullscreen();
      else { scene.classList.add('expanded'); document.body.style.overflow='hidden'; }
    } catch (error) {scene.classList.toggle('expanded');document.body.style.overflow=scene.classList.contains('expanded')?'hidden':'';}
    updateFullscreen();
  });
  document.addEventListener('fullscreenchange', updateFullscreen);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && scene.classList.contains('expanded')) {scene.classList.remove('expanded');document.body.style.overflow='';updateFullscreen();}
    if (event.code !== 'Space' || dialog.open || /INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY/.test(event.target.tagName) || event.target.isContentEditable) return;
    event.preventDefault(); paused = !paused; updatePlayback();
  });
  reduceMotion.addEventListener('change', event => { if (event.matches) {paused=true;updatePlayback();} });
  try {
    renderer = new window.CuttlefishArtwork(canvas, {...state,behaviors:state.behaviors.slice(),paused});
    updatePlayback();
    refreshControls();
    refreshTelemetry();
    const telemetryTimer = setInterval(refreshTelemetry, 200);
    window.addEventListener('pagehide', event => {
      if (!event.persisted) { clearInterval(telemetryTimer); renderer?.destroy(); }
    });
  } catch (error) {
    console.error('Artwork could not initialize:', error);
    scene.classList.add('error');
    $('stats').textContent = 'ARTWORK UNAVAILABLE';
    $('live-label').textContent = 'OFFLINE';
    $('status-dot').classList.add('paused');
  }
})();
