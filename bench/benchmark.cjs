#!/usr/bin/env node
'use strict';
/**
 * Deterministic CPU-path microbenchmark for an inspected CuttlefishArtwork source.
 * Canvas methods are NO-OPS. This measures real simulation, geometry, projection,
 * glyph-grid iteration, and JavaScript dispatch, NOT Canvas rasterization, GPU,
 * presentation, browser layout, power, or end-to-end FPS.
 *
 * node benchmark.cjs --source /absolute/path/artwork.js --out baseline.json
 * node benchmark.cjs --source /absolute/path/cuttlefish.js --esm --out candidate.json
 * No installation, network, publishing, or browser automation is performed.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { performance: timer } = require('node:perf_hooks');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf('--' + name);
  return index === -1 ? fallback : args[index + 1];
}
function positive(name, fallback) {
  const number = Number(arg(name, fallback));
  if (!Number.isFinite(number) || number <= 0) throw new Error(name + ' must be positive');
  return number;
}
const sourcePath = path.resolve(arg('source', path.join(__dirname, '../dist/artwork.js')));
const config = {
  width: positive('width', 947), height: positive('height', 707), dpr: positive('dpr', 1),
  warmupFrames: Math.floor(positive('warmup', 45)), framesPerRepetition: Math.floor(positive('frames', 120)),
  repetitions: Math.floor(positive('repetitions', 5)), dtSeconds: 1 / 60,
  startTimeSeconds: 8, counts: [1, 4, 12]
};
function events(target = {}) {
  const listeners = new Map();
  target.addEventListener = (type, handler) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  };
  target.removeEventListener = (type, handler) => listeners.get(type)?.delete(handler);
  target.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  target.listenerCount = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
  return target;
}
function environment() {
  let clock = 1000, sequence = 0;
  const pending = new Map(), commands = {};
  let countCommands = false;
  const method = name => (..._args) => { if (countCommands) commands[name] = (commands[name] || 0) + 1; };
  function context() {
    return {
      createRadialGradient: () => ({ addColorStop() {} }),
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      setTransform: method('setTransform'), clearRect: method('clearRect'),
      fillRect: method('fillRect'), fillText: method('fillText'), drawImage: method('drawImage'),
      putImageData: method('putImageData'), beginPath: method('beginPath'),
      arc: method('arc'), fill: method('fill')
    };
  }
  const document = events({ hidden: false, visibilityState: 'visible' });
  const media = events({ matches: false, media: '(prefers-reduced-motion: reduce)' });
  const requestAnimationFrame = fn => { const id = ++sequence; pending.set(id, fn); return id; };
  const cancelAnimationFrame = id => pending.delete(id);
  const ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
  const IntersectionObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };
  const window = events({ devicePixelRatio: config.dpr, document, requestAnimationFrame, cancelAnimationFrame,
    ResizeObserver, IntersectionObserver, matchMedia: () => media, performance: { now: () => clock } });
  document.defaultView = window;
  function canvas(width = config.width, height = config.height) {
    const ctx = context();
    return events({ width: 0, height: 0, ownerDocument: document, isConnected: true,
      getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
      setAttribute() {}, removeAttribute() {} });
  }
  document.createElement = () => canvas();
  return { scope: { window, document, performance: window.performance, ResizeObserver, IntersectionObserver,
      requestAnimationFrame, cancelAnimationFrame, CustomEvent: class { constructor(type) { this.type = type; } } },
    canvas, pending, media, commands,
    clock: value => { clock = value; },
    accounting: value => { countCommands = value; for (const name of Object.keys(commands)) delete commands[name]; },
    fireFrame(time) { clock = time; const callbacks = [...pending.entries()]; pending.clear(); for (const [, fn] of callbacks) fn(time); }
  };
}
function percentile(sorted, proportion) { return sorted[Math.max(0, Math.ceil(sorted.length * proportion) - 1)]; }
function summary(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return { samples: sorted.length, mean: values.reduce((a,b) => a+b,0)/values.length,
    median: percentile(sorted,.5), p95: percentile(sorted,.95), p99: percentile(sorted,.99), min:sorted[0], max:sorted.at(-1) };
}
async function loadArtwork(env, source) {
  if (args.includes('--esm')) {
    for (const [key, value] of Object.entries(env.scope)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    const module = await import(pathToFileURL(sourcePath).href);
    return module.CuttlefishArtwork || module.default;
  }
  const keys = Object.keys(env.scope);
  return new Function(...keys, source + '\nreturn window.CuttlefishArtwork;')(...Object.values(env.scope));
}
async function main() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const scenarios = [];
  const env = environment();
  const Artwork = await loadArtwork(env, source);
  for (const count of config.counts) {
    if (typeof Artwork !== 'function') throw new Error('Expected CuttlefishArtwork export');
    const manual = typeof Artwork.prototype.advance === 'function';
    const instance = new Artwork(env.canvas(), {
      autoStart: !manual, reducedMotion: 'ignore', observeVisibility: false,
      count, scene: 'reactive', formation: 'independent', size: .7, sizeVariation: .45,
      density: 1.1, depthStrength: 1.2, speed: 1, glow: true, paused: false
    });
    const repetitions = [];
    let frameId = 0;
    function reset() {
      instance.restart();
      instance.time = config.startTimeSeconds;
      for (const fish of instance.fish) fish.sceneTime = config.startTimeSeconds;
      instance.render();
      instance.last = 0;
      frameId = 0;
    }
    function frame() {
      const now = 1000 + (++frameId) * config.dtSeconds * 1000;
      env.clock(now);
      // Deliver one queued rAF only; this exercises the native engine scheduler
      // rather than spawning duplicate schedules by calling _tick directly.
      if (manual) instance.advance(frameId === 1 ? 0 : config.dtSeconds);
      else env.fireFrame(now);
    }
    for (let repeat = 0; repeat < config.repetitions; repeat++) {
      reset();
      for (let i=0; i<config.warmupFrames; i++) frame();
      const milliseconds = [];
      const cpuStart = process.cpuUsage();
      const wallStart = timer.now();
      for (let i=0; i<config.framesPerRepetition; i++) {
        const before = timer.now(); frame(); milliseconds.push(timer.now()-before);
      }
      const wallElapsedMilliseconds = timer.now() - wallStart;
      const cpu = process.cpuUsage(cpuStart);
      const processCpuMilliseconds = (cpu.user + cpu.system) / 1000;
      repetitions.push({ index: repeat + 1, milliseconds, summaryMilliseconds: summary(milliseconds),
        wallElapsedMilliseconds, processCpuMilliseconds, processCpuMeanMilliseconds: processCpuMilliseconds / config.framesPerRepetition });
    }
    env.accounting(true); frame(); env.accounting(false);
    // Draw counts measured separately so counted dispatch is not part of timing.
    env.accounting(true); instance.render(); const drawCommands = { ...env.commands }; env.accounting(false);
    const typedArrayBytes = Object.values(instance).filter(ArrayBuffer.isView).reduce((sum, value) => sum + value.byteLength, 0)
      + (instance.glowPixels?.data?.byteLength || 0)
      + (instance._gripPoints || []).reduce((sum, value) => sum + value.byteLength, 0);
    const canvases = ['canvas','atlas','inkAtlas','glowCanvas','haloCanvas'].map(name => ({ name,
      width: instance[name]?.width || 0, height: instance[name]?.height || 0 }));
    const flat = repetitions.flatMap(item => item.milliseconds);
    scenarios.push({ count, driver: manual ? 'public advance(seconds), autoStart:false' : 'queued rAF callback, original scheduler', repetitions, summaryMilliseconds: summary(flat),
      processCpuMeanMilliseconds: repetitions.reduce((sum,rep)=>sum+rep.processCpuMilliseconds,0) / flat.length,
      stateAtEnd: { simulationTime: instance.time, glyphs: instance.glyphCount, inkGlyphs: instance.inkGlyphCount || 0,
        visibleCount: instance.fish.filter(fish=>fish.visible).length, gridCells: instance.cols*instance.rows,
        samplesLastFish: instance.sampleCount, pendingRafCallbacks: env.pending.size },
      drawCommandsOneAccountingFrame: drawCommands,
      memoryCalculated: { typedArrayBytes, canvases, canvasRgba8EquivalentBytes: canvases.reduce((sum, canvas)=>sum+4*canvas.width*canvas.height,0),
        caveat: 'Calculated storage from dimensions, not measured browser/GPU/process memory; excludes driver copies, objects, padding, string heaps.' }
    });
    instance.destroy();
  }
  const report = {
    schemaVersion: 1, measuredAt: new Date().toISOString(),
    measurement: 'Node CPU execution of real engine simulation/geometry/grid paths with Canvas 2D methods stubbed; NOT browser FPS or renderer throughput',
    source: { path: sourcePath, sha256: crypto.createHash('sha256').update(source).digest('hex'), bytes: Buffer.byteLength(source) },
    environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
      cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, osRelease: os.release() },
    config, scenarios,
    limitations: [ 'Canvas calls, text rasterization, blur, GPU, compositing, presentation and browser layout are stubbed.',
      'This process shares compute resources; p95/p99 are noisy. No browser FPS, mobile performance, energy, or improvement is implied.',
      'The class is compiled/imported once and reused across counts; process CPU elapsed per repetition helps distinguish host scheduling from execution.',
      'Baseline is an inspected microsite file, not a published npm package. Per-frame timings include harness dispatch overhead.',
      'A candidate exposing advance(seconds) uses its manual driver with autoStart:false; baseline uses its original queued rAF. Scheduler overhead therefore differs.',
      'No ink/startle is present in these independent-roaming scenarios. Use the browser harness for that additional workload.' ]
  };
  const output = JSON.stringify(report, null, 2) + '\n';
  if (arg('out')) fs.writeFileSync(path.resolve(arg('out')), output); else process.stdout.write(output);
  if (arg('out')) console.log(JSON.stringify({ output: path.resolve(arg('out')), scenarios: scenarios.map(item=>({ count:item.count,...item.summaryMilliseconds,processCpuMeanMilliseconds:item.processCpuMeanMilliseconds })) },null,2));
}
module.exports = { environment, loadArtwork, config };
if (require.main === module) main().catch(error=>{ console.error(error); process.exitCode=1; });
