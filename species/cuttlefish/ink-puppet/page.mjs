import { createInkPuppet } from './browser.mjs';
import { CuttlefishArtwork } from '../../../src/animals/cuttlefish.js';

const $ = id => document.getElementById(id);
const canvas = $('artwork');
const scope = new AbortController();
const on = (target, type, callback) => target.addEventListener(type, callback, { signal: scope.signal });
const manual = new URLSearchParams(location.search).has('manual');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const keys = Object.freeze({ notice: ['investigate', .5], reach: ['investigate', 2.25], jet: ['retreat', 1.75], settle: ['retreat', 5.1] });
let tool = 'investigate';
let target = { x: .3, y: -.10 };
let unsubscribe;
let recording = null;
let recordURL = null;
let exportURL = null;
let disposed = false;
let playbackStarted = !manual;
let lastPhase = '';
let lastPaused = null;
let lastEvidenceTick = -1;
export let artwork;

function announce(message) { $('status').textContent = message; }
function setPressed(selector, value, field) {
  document.querySelectorAll(selector).forEach(button => button.setAttribute('aria-pressed', String(button.dataset[field] === value)));
}
function sync(stats = artwork?.getStats()) {
  if (!stats || disposed) return;
  if (lastPaused !== stats.paused) {
    $('pause').textContent = stats.paused ? 'Play' : 'Pause';
    $('pause').setAttribute('aria-label', stats.paused ? 'Play animation' : 'Pause animation');
    lastPaused = stats.paused;
  }
  const phase = $('view').value === 'puppet' ? `${stats.paused ? 'STILL / ' : ''}${stats.phase}`
    : `SOURCE / ${stats.paused ? 'STILL' : 'PLAYING'}`;
  if (phase !== lastPhase) { $('phase').textContent = phase; lastPhase = phase; }
  if ($('view').value === 'puppet') {
    if (document.querySelector('details').open && stats.tick - lastEvidenceTick >= 60) {
      $('evidence').textContent = `Seed 7 · tick ${stats.tick} · ${stats.glyphs} visible glyphs · ${stats.width} × ${stats.height} CSS px · ${stats.running ? 'running' : 'resting'}`;
      lastEvidenceTick = stats.tick;
    }
    if (recording && !recording.retreat && stats.tick >= 400) {
      recording.retreat = true;
      if (!artwork.cue({ type: 'retreat', x: .25, y: -.10 })) finishRecording(false);
    }
    if (recording && stats.tick >= 780) finishRecording(true);
  }
}

function sourceOptions(kind, paused) {
  const size = Number($('size').value);
  return { species: 'cuttlefish', seed: 7, count: kind === 'swim' ? 4 : 1,
    scene: kind === 'lens' ? 'encounter' : kind === 'swim' ? 'swimby' : 'reactive',
    size: kind === 'swim' ? .35 : size, ...(kind === 'source' ? {} : { sizeVariation: 0 }),
    followPointer: kind === 'source', autoStart: false,
    ...(paused !== undefined ? { paused } : manual ? { paused: true } : {}),
    formation: 'independent', behaviors: kind === 'swim' ? ['cruise', 'cruise', 'cruise', 'cruise'] : [] };
}
function mount() {
  if (recording) finishRecording(false);
  const previousPaused = artwork?.paused;
  unsubscribe?.(); artwork?.destroy();
  const kind = $('view').value;
  const puppet = kind === 'puppet';
  if (puppet) {
    artwork = createInkPuppet(canvas, { seed: 7, autoStart: playbackStarted, size: Number($('size').value),
      ...(previousPaused !== undefined ? { paused: previousPaused } : manual ? { paused: true } : {}) });
    artwork.setTool(tool);
    unsubscribe = artwork.subscribe(sync);
  } else {
    artwork = new CuttlefishArtwork(canvas, sourceOptions(kind, previousPaused));
    // These explicit source snapshots exercise the existing public step API.
    // No geometry, camera, lens or small-swim function is replaced here.
    const seconds = kind === 'lens' ? 12 : kind === 'swim' ? 4 : 0;
    for (let tick = 0; tick < seconds * 60; tick++) artwork.advance(1 / 60);
    artwork.setOptions({ autoStart: playbackStarted });
    unsubscribe = null;
  }
  $('source-label').textContent = ({ puppet: 'INK PUPPET / LOCAL PROTOTYPE', source: 'CURRENT MAIN / GALLERY OPTIONS', lens: 'CURRENT MAIN / APPROVED FULL LENS', swim: 'CURRENT MAIN / 35% SWIMMERS' })[kind];
  $('hint').textContent = puppet
    ? 'Choose an action, then tap anywhere in the water. The position changes the response.'
    : 'Unmodified current-main renderer. These comparison views preserve the existing framing and movement.';
  document.querySelectorAll('[data-tool], [data-still], #play-sequence, #record').forEach(button => { button.disabled = !puppet; });
  $('size').disabled = kind === 'swim';
  lastPhase = ''; lastEvidenceTick = -1;
  sync();
  announce(reduced.matches ? 'Reduced motion: choose a static motion key to explore the character.'
    : manual ? 'Manual review mode. Static keys are ready; Play starts a live sequence.' : 'The current is yours to explore.');
}

function act(type) {
  if ($('view').value !== 'puppet') return;
  if (recording) finishRecording(false);
  if (artwork.paused) {
    artwork.showStill(type, type === 'investigate' ? 2.25 : 1.75, target);
    announce('A still from this gesture. Motion stays paused.');
  } else if (artwork.cue({ type, ...target })) {
    announce(type === 'investigate' ? 'A glance, a gather, then a reach toward your shrimp.' : 'The disturbance sends the cuttlefish softly away from your chosen point.');
  } else announce('Let this gesture settle before inviting another.');
  sync();
}
on($('view'), 'change', mount);
on($('size'), 'change', () => { if (recording) finishRecording(false); artwork.setOptions({ size: Number($('size').value) }); sync(); });
on($('pause'), 'click', () => {
  if (recording) finishRecording(false);
  if (reduced.matches) { announce('Reduced motion is active. The motion keys remain available as stills.'); return; }
  playbackStarted = true;
  artwork.setOptions({ autoStart: true });
  artwork.setPaused(!artwork.paused);
  sync();
  announce(artwork.paused ? 'Paused. Choose a key to study the gesture.' : 'Watching the current.');
});
on($('restart'), 'click', () => {
  if (recording) finishRecording(false);
  if ($('view').value === 'puppet') artwork.restart(); else mount();
  sync(); announce(artwork.paused ? 'A fresh still. Your pause is preserved.' : 'Back to the current.');
});
document.querySelectorAll('[data-tool]').forEach(button => on(button, 'click', () => {
  if (recording) finishRecording(false);
  tool = button.dataset.tool; artwork.setTool(tool); setPressed('[data-tool]', tool, 'tool');
  announce(tool === 'investigate' ? 'Tap the water to place a shrimp.' : 'Tap the water to choose the source of the disturbance.');
}));
document.querySelectorAll('[data-still]').forEach(button => on(button, 'click', () => {
  if (recording) finishRecording(false);
  const [type, seconds] = keys[button.dataset.still];
  artwork.showStill(type, seconds, target);
  setPressed('[data-still]', button.dataset.still, 'still');
  announce(`${button.querySelector('strong').textContent}. Static motion key.`);
  sync();
}));
on($('play-sequence'), 'click', () => {
  if (reduced.matches) { act(tool); return; }
  if (recording) finishRecording(false);
  playbackStarted = true;
  artwork.restart(); artwork.setOptions({ autoStart: true }); artwork.setPaused(false);
  act(tool);
});
on(canvas, 'keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === ' ') { event.preventDefault(); $('pause').click(); }
  else if (key === 'escape') { artwork.restart(); sync(); }
  else if (['i', 'r'].includes(key)) { event.preventDefault(); act(key === 'i' ? 'investigate' : 'retreat'); }
  else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) && $('view').value === 'puppet') {
    event.preventDefault();
    target = { x: Math.max(-.42, Math.min(.42, target.x + (key === 'arrowright' ? .08 : key === 'arrowleft' ? -.08 : 0))),
      y: Math.max(-.35, Math.min(.35, target.y + (key === 'arrowdown' ? .08 : key === 'arrowup' ? -.08 : 0))) };
    artwork.cue({ type: 'point', ...target });
    announce(`Target moved ${target.x < 0 ? 'left' : 'right'}, ${target.y < 0 ? 'above' : 'below'} centre. Press I or R.`);
  }
});
on(canvas, 'pointerdown', event => {
  if ($('view').value !== 'puppet') return;
  if (recording) finishRecording(false);
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  target = { x: Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5)),
    y: Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5)) };
  const instance = artwork, wasPaused = artwork.paused, sequence = artwork.getState().sequence;
  // The standalone controller also owns pointerdown. Read its outcome after
  // every handler has run; a rejected rapid tap must not announce success.
  queueMicrotask(() => {
    if (disposed || artwork !== instance) return;
    announce(wasPaused ? 'A still at your chosen point.' : artwork.getState().sequence > sequence
      ? tool === 'investigate' ? 'Investigating your invitation.' : 'Moving softly away from the disturbance.'
      : 'Let this gesture settle before inviting another.');
  });
});

function download(blob, filename) {
  if (exportURL) URL.revokeObjectURL(exportURL);
  exportURL = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = exportURL; link.download = filename; link.click();
}
on($('save'), 'click', () => canvas.toBlob(blob => { if (blob && !disposed) download(blob, `cuttlefish-${$('view').value}-${$('phase').textContent.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`); }, 'image/png'));

function finishRecording(complete) {
  if (!recording) return;
  const active = recording; recording = null;
  active.complete = complete;
  clearTimeout(active.timeout);
  if (active.recorder.state !== 'inactive') active.recorder.stop();
  active.stream.getTracks().forEach(track => track.stop());
  $('record').textContent = 'Record both moments';
}
on($('record'), 'click', () => {
  if (recording) { finishRecording(false); return; }
  if (reduced.matches) { announce('Reduced motion is active. Use the static keys for this review.'); return; }
  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') { announce('Video recording is unavailable in this browser. Save frames or play each sequence.'); return; }
  // On a phone the export controls sit below the artwork. Bring the subject
  // back into view before capturing, so offscreen suspension remains useful.
  canvas.scrollIntoView({ block: 'center', behavior: 'instant' });
  canvas.focus({ preventScroll: true });
  let stream, recorder;
  try {
    stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  } catch {
    stream?.getTracks().forEach(track => track.stop());
    announce('This browser could not start a recording. Save frames or play the gestures.');
    return;
  }
  const active = { recorder, stream, chunks: [], complete: false, retreat: false, timeout: null };
  recorder.addEventListener('error', () => finishRecording(false));
  recorder.addEventListener('dataavailable', event => { if (event.data.size) active.chunks.push(event.data); });
  recorder.addEventListener('stop', () => {
    if (disposed) return;
    const blob = new Blob(active.chunks, { type: recorder.mimeType || 'video/webm' });
    if (recordURL) URL.revokeObjectURL(recordURL);
    recordURL = URL.createObjectURL(blob);
    let link = $('motion-download');
    if (!link) { link = document.createElement('a'); link.id = 'motion-download'; link.className = 'motion-link'; $('record').parentElement.append(link); }
    link.href = recordURL;
    link.download = `cuttlefish-ink-puppet-${active.complete ? 'both-moments' : 'partial'}.webm`;
    link.textContent = active.complete ? 'Download motion' : 'Download partial motion';
    announce(active.complete ? 'Both moments recorded from the browser canvas at normal speed.' : 'Recording stopped early. The partial capture is available.');
    sync();
  });
  playbackStarted = true;
  artwork.restart(); artwork.setOptions({ autoStart: true }); artwork.setPaused(false);
  recording = active;
  try { recorder.start(); } catch {
    recording = null; stream.getTracks().forEach(track => track.stop());
    announce('This browser could not start a recording. Save frames or play the gestures.');
    return;
  }
  artwork.cue({ type: 'investigate', x: .3, y: -.1 });
  active.timeout = setTimeout(() => finishRecording(false), 22000);
  $('record').textContent = 'Stop recording';
  announce('Recording two moments at normal speed. Keep the character in view.');
});
on(document, 'visibilitychange', () => { if (document.hidden && recording) finishRecording(false); });
const recordVisibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  if (recording && entries.some(entry => entry.target === canvas && !entry.isIntersecting)) finishRecording(false);
}) : null;
recordVisibility?.observe(canvas);
on(reduced, 'change', event => {
  if (event.matches && recording) finishRecording(false);
  sync(); if (event.matches) announce('Reduced motion is active. Explore the gesture as stills.');
});
export function dispose() {
  if (disposed) return;
  disposed = true;
  finishRecording(false);
  unsubscribe?.(); recordVisibility?.disconnect(); scope.abort(); artwork?.destroy();
  if (recordURL) URL.revokeObjectURL(recordURL);
  if (exportURL) URL.revokeObjectURL(exportURL);
}
on(window, 'pagehide', event => { if (!event.persisted) dispose(); });
try { mount(); } catch (error) {
  announce(`This study could not open. ${error instanceof Error ? error.message : String(error)}`);
  $('phase').textContent = 'UNAVAILABLE';
  document.querySelectorAll('button,select').forEach(control => { control.disabled = true; });
  throw error;
}
