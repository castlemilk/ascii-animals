/* Cuttlefish-only authored study. The canonical marine renderer is inherited,
 * never copied or patched. Private seams are pinned in docs/CUTTLEFISH-STUDY.md. */
import { CuttlefishArtwork } from './cuttlefish.js';
import { createStudyState, cueStudy, stepStudy, sampleStudy, getStudyState } from './cuttlefish-study-director.js';

const DT = 1 / 60;
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const defaults = Object.freeze({ automatic: true, habitat: true, restrainedSkin: true, concealFeedingTentacles: true });
const TOTAL_ARM_SAMPLES = Object.freeze({
  swim: [[7344, 10746], [1892, 2765], [1042, 1432]],
  grip: [[9528, 12552], [2664, 3440], [1288, 1678]]
});

export function normalizeCuttlefishStudy(options = {}, previous = defaults) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Study options must be an object.');
  const next = { ...previous };
  for (const [key, value] of Object.entries(options)) {
    if (!Object.hasOwn(defaults, key)) throw new TypeError(`Unknown cuttlefish study option: ${key}`);
    if (typeof value !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
    next[key] = value;
  }
  return Object.freeze(next);
}

function validateArtwork(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Artwork options must be an object.');
  if (options.species !== undefined && options.species !== 'cuttlefish') throw new TypeError('This study owns cuttlefish only.');
  if (options.speciesByAnimal !== undefined && (!Array.isArray(options.speciesByAnimal) || options.speciesByAnimal.some(s => s !== 'cuttlefish'))) {
    throw new TypeError('This study cannot replace another species.');
  }
  if (options.seed !== undefined && (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff)) {
    throw new RangeError('Study seed must be an unsigned 32-bit integer.');
  }
}

// Both pinned sources emit the complete eight primary arms first, followed by
// the two feeding tentacles. This describes only the final visibility streams;
// it never reconstructs centerlines, sleeves, normals or primary-arm samples.
function feedingSamples(lod, grip) {
  const segments = Math.round(84 / lod);
  let samples = (segments + 1) * Math.ceil((grip ? 12 : 10) / lod);
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    if (grip ? i % 6 === 0 && u > .10 && u < .95 : i % 5 === 0 && u > .12 && u < .96) samples += grip ? 9 : 1;
  }
  return samples * 2;
}

export class CuttlefishStudyArtwork extends CuttlefishArtwork {
  constructor(canvas, study = {}, artwork = {}) {
    const config = normalizeCuttlefishStudy(study);
    validateArtwork(artwork);
    // Omit paused unless the caller supplies it: the superclass honors system
    // reduced motion. It calls virtual methods before our fields exist.
    super(canvas, { scene: 'reactive', count: 1, size: (artwork.count ?? 1) === 1 ? 1.4 : 1.16, sizeVariation: 0,
      behaviors: ['hover'], ripple: .85, density: 1.4, speed: .85,
      followPointer: false, ...artwork, species: 'cuttlefish' });
    try {
      this._studyConfig = config;
      this._studyState = createStudyState(this.options.seed, { automatic: config.automatic });
      this._studyAccumulator = 0;
      this._studyArmBuffer = new Float64Array(16384 * 6);
      this._studyArmCount = 0;
      this._studyConcealment = 'verified';
      this._studyFocus = 0;
      this._studyQuietPlankton = this.plankton;
      this.plankton = this.plankton.filter((_, i) => i % 2 === 0);
      this.canvas.removeEventListener('pointerdown', this._touch);
      this._touch = e => this._studyPointerDown(e);
      this.canvas.addEventListener('pointerdown', this._touch, { passive: true });
      this.canvas.removeEventListener('pointerleave', this._leave);
      this.canvas.removeEventListener('pointercancel', this._leave);
      this._leave = () => {
        if (this.destroyed) return;
        this.pointer.active = false; this.pointer.tx = this.pointer.ty = 0; this.lastPointer = null;
        if (this._studyState) cueStudy(this._studyState, { type: 'release' });
      };
      this.canvas.addEventListener('pointerleave', this._leave, { passive: true });
      this.canvas.addEventListener('pointercancel', this._leave, { passive: true });
      this.canvas.addEventListener('lostpointercapture', this._leave, { passive: true });
      this.render();
    } catch (error) { this.destroy(); throw error; }
  }

  _legacySingle() { return this._studyState ? false : super._legacySingle(); }

  _schoolPose(t) {
    if (!this._studyState || this.options.formation !== 'independent' || this._director) return super._schoolPose(t);
    const fish = this.activeFish;
    const pose = sampleStudy(this._studyState, { id: fish.id, seed: fish.seed, count: this.fish.length },
      { width: this.width, height: this.height });
    this._studyPose = pose;
    this.phase = pose.phase; this.progress = pose.progress;
    return pose;
  }

  _simulate(dt) {
    if (!this._studyState) return super._simulate(dt);
    this._studyAccumulator += dt;
    const steps = Math.min(6, Math.floor((this._studyAccumulator + 1e-10) / DT));
    this._studyAccumulator = Math.max(0, this._studyAccumulator - steps * DT);
    this._studySuppressRender = true;
    try {
      for (let i = 0; i < steps; i++) {
        const signal = stepStudy(this._studyState);
        if (signal.jet) {
          // Manual advance intentionally ignores pause, like the inherited API.
          // Only this explicit replay step may temporarily bypass its reaction
          // guard; no input or requestAnimationFrame path can resume playback.
          const paused = this.paused;
          this.paused = false;
          try { this._startle('study', this._studyFocus); } finally { this.paused = paused; }
        }
        super._simulate(DT);
      }
    } finally { this._studySuppressRender = false; }
    this.render();
  }

  render() {
    if (this._studySuppressRender) return;
    super.render();
  }

  _body(t) {
    if (!this._studyConfig) return super._body(t);
    const ripple = this.options.ripple;
    this._studyPart = 'body';
    // Alter fin-wave energy through the existing parameter only. The accepted
    // mantle/head/eye surfaces and root attachment functions stay inherited.
    this.options.ripple = ripple * (.70 + .30 * (this._studyPose?.alert || 0));
    try { super._body(t); } finally { this.options.ripple = ripple; this._studyPart = null; }
  }

  _eye(...args) {
    const part = this._studyPart; this._studyPart = 'eye';
    try { return super._eye(...args); } finally { this._studyPart = part; }
  }

  _shade(nx, ny, nz, detail = 0, fin = false, unit = false) {
    if (this._studyPart === 'body' && this._studyConfig?.restrainedSkin && !fin) {
      const alert = this._studyPose?.alert || 0;
      detail *= .24 + .22 * alert;
    }
    return super._shade(nx, ny, nz, detail, fin, unit);
  }

  _put(x, y, z, light, kind = 0, seed = 0) {
    if (this._studyCapturingArms) {
      const n = this._studyArmCount++ * 6;
      if (n + 6 > this._studyArmBuffer.length) throw new RangeError('Inherited arm topology exceeded the pinned study buffer.');
      const b = this._studyArmBuffer;
      b[n] = x; b[n + 1] = y; b[n + 2] = z;
      b[n + 3] = light; b[n + 4] = kind; b[n + 5] = seed;
      return;
    }
    if (this._studyPart === 'body' && this._studyConfig?.restrainedSkin && kind === 0 && x < .49) {
      const phase = (this.options.seed % 997) / 997 * TAU;
      // Stable broad patches, not frame-random sparkle. Tiny detail sits under
      // the existing normal lighting and never touches the eye's dark slit.
      light += .018 * Math.sin(x * 5.4 + y * 4.2 + phase) * Math.cos(z * 7 - y * 2.5);
    }
    super._put(x, y, z, light, kind, seed);
  }

  _arms(t) {
    if (!this._studyConfig?.concealFeedingTentacles) return super._arms(t);
    this._studyArmCount = 0; this._studyCapturingArms = true;
    try { super._arms(t); } finally { this._studyCapturingArms = false; }
    const lod = this.geometryStep || 1;
    const grip = clamp(Number(this.encounterGrip) || 0, 0, 1) * (1 - .9 * clamp(Number(this.escapeAmount) || 0, 0, 1)) > .001;
    const expected = TOTAL_ARM_SAMPLES[grip ? 'grip' : 'swim'][lod - 1];
    if (!expected?.includes(this._studyArmCount)) {
      // An unknown integration must preserve all inherited geometry. It cannot
      // silently misidentify a primary-arm sample as a hidden tentacle.
      this._studyConcealment = 'unsupported-topology';
    } else this._studyConcealment = 'verified';
    const end = this._studyArmCount - (this._studyConcealment === 'verified' ? feedingSamples(lod, grip) : 0);
    for (let i = 0; i < end; i++) {
      const n = i * 6, b = this._studyArmBuffer;
      super._put(b[n], b[n + 1], b[n + 2], b[n + 3], b[n + 4], b[n + 5]);
    }
  }

  _escapeOffset(age) {
    const offset = super._escapeOffset(age);
    if (!this._studyState || this._director) return offset;
    // Keep the retreat in the observation volume. The same inherited eased
    // recovery returns from this endpoint; there is no position snap.
    return offset.map(v => v * .28);
  }

  _emitInk(count, progress) {
    const previous = this.ink.length;
    super._emitInk(count, progress);
    if (!this._studyState || this._director) return;
    for (let i = previous; i < this.ink.length; i++) {
      const p = this.ink[i];
      p.vx *= .52; p.vy *= .52; p.vz *= .52;
      p.life = 2.8 + .4 * (1 + Math.sin(p.phase));
      p.directorInk = true;
    }
  }

  _drawInk() {
    if (!this._studyState || this._director || !this.ink.length) return super._drawInk();
    const c = this.ctx;
    // A small directional edge catches light in dark water. The inherited
    // character cores, density field and particle paths remain untouched.
    c.save();
    c.shadowColor = 'rgba(153,177,158,.8)';
    c.shadowBlur = 0; c.shadowOffsetX = .8; c.shadowOffsetY = .8;
    try { return super._drawInk(); } finally { c.restore(); }
  }

  _rasterize() {
    if (this._studyConfig?.habitat && this.activeFish.id === 0 && !this._director) this._drawStudyHabitat();
    super._rasterize();
  }

  _drawStudyHabitat() {
    const c = this.ctx, w = this.width, h = this.height, t = this._studyState.tick * DT;
    const seed = (this.options.seed % 991) / 991 * TAU;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${Math.max(7, Math.min(10, this.cellH * .8))}px monospace`;
    // A low, distant shelf; a nearer sand contour. The empty water between
    // these layers and the animal keeps the upper-arm silhouette legible.
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 74; i++) {
      const u = i / 73;
      const y = h * (.80 + layer * .09 + .012 * Math.sin(u * 17 + seed + layer) + .007 * Math.sin(u * 37));
      c.fillStyle = layer === 0 ? 'rgba(118,161,153,.16)' : 'rgba(165,172,146,.23)';
      c.fillText(i % 11 === 0 ? '~' : i % 5 === 0 ? ':' : '.', w * (.035 + u * .93), y);
    }
    // Two small eelgrass stands. Their slow phase and differing heights imply
    // current/depth without filling the central observation window.
    for (let side = 0; side < 2; side++) for (let blade = 0; blade < 4; blade++) {
      const baseX = w * (side ? .90 + blade * .017 : .06 + blade * .018);
      const height = h * (.07 + ((blade * 3 + side) % 4) * .025);
      for (let j = 0; j < 11; j++) {
        const u = j / 10;
        const sway = Math.sin(t * .37 + blade * .65 + side * 2 + seed) * 4 * u * u;
        c.fillStyle = `rgba(117,162,140,${side ? .19 : .25})`;
        c.fillText(u < .4 ? '|' : '/', baseX + sway + Math.sin(u * 2.1 + blade) * 6 * u, h * .91 - height * u);
      }
    }
    const s = getStudyState(this._studyState);
    if (s.pointer || s.action?.kind === 'investigate') {
      const target = s.action?.target || s.target;
      const x = (target[0] + .5) * w, y = (target[1] + .5) * h;
      c.strokeStyle = 'rgba(208,216,181,.35)'; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 7, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(208,216,181,.7)'; c.fillText('+', x, y);
    }
    c.restore();
  }

  _studyPoint(event) {
    if (this.destroyed || !this.width || !this.height || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { x: clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5),
      y: clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5) };
  }

  _pointerMove(event) {
    if (!this._studyState) return super._pointerMove(event);
    const point = this._studyPoint(event);
    if (!point || this.paused || this._document.hidden) return;
    this.pointer.tx = point.x; this.pointer.ty = point.y; this.pointer.active = true;
    cueStudy(this._studyState, { type: 'pointer', ...point });
  }

  _studyPointerDown(event) {
    const point = this._studyPoint(event);
    if (!point) return;
    // A tap anywhere invites inspection. Retreat is deliberate through its
    // semantic control/key; accidental hover and empty-water taps never ink.
    if (this.paused) this.showStudyStill('investigate', 3.2, point);
    else this.cueStudy({ type: 'investigate', ...point });
  }

  cueStudy(input) {
    if (this.destroyed) return false;
    // Validate even while paused, without changing state or scheduling work.
    if (this.paused) {
      const probe = createStudyState(this.options.seed, { automatic: this._studyConfig.automatic });
      cueStudy(probe, input);
      return false;
    }
    const accepted = cueStudy(this._studyState, input);
    if (accepted) {
      if (input?.x !== undefined) this.pointer.tx = input.x;
      if (input?.y !== undefined) this.pointer.ty = input.y;
    }
    return accepted;
  }

  getStudy() {
    return Object.freeze({ ...getStudyState(this._studyState), config: this._studyConfig,
      anatomy: Object.freeze({ primaryArms: 8, feedingTentacles: 2,
        feedingVisibility: this._studyConfig.concealFeedingTentacles ? this._studyConcealment : 'inherited' }),
      disposed: this.destroyed });
  }

  setStudy(patch) {
    if (this.destroyed) return;
    const next = normalizeCuttlefishStudy(patch, this._studyConfig);
    this._studyConfig = next;
    this._studyState.automatic = next.automatic;
    this.render();
  }

  showStudyStill(action = 'investigate', seconds = 3.2, point) {
    if (this.destroyed) return false;
    if (!['hover', 'investigate', 'turn', 'retreat'].includes(action)) throw new TypeError('Unknown study still.');
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 16) throw new RangeError('Still time must be between 0 and 16 seconds.');
    const input = { type: action, ...(point || {}) };
    const probe = createStudyState(this.options.seed, { automatic: false });
    if (!cueStudy(probe, { ...input, type: action === 'hover' ? 'investigate' : action })) return false;
    if (!this.width || !this.height) return false;
    this.setPaused(true); this.restart();
    const automatic = this._studyState.automatic;
    this._studyState.automatic = false;
    if (action !== 'hover') cueStudy(this._studyState, input);
    this._studySuppressRender = true;
    try {
      for (let i = 0, ticks = Math.round(seconds * 60); i < ticks; i++) {
        const signal = stepStudy(this._studyState);
        if (signal.jet) {
          const paused = this.paused; this.paused = false;
          try { this._startle('study-still', this._studyFocus); } finally { this.paused = paused; }
        }
        super._simulate(DT);
      }
    } finally { this._studySuppressRender = false; this._studyState.automatic = automatic; }
    this.render(); return true;
  }

  setOptions(patch) {
    if (this.destroyed) return;
    validateArtwork(patch);
    const oldSeed = this.options.seed;
    super.setOptions(patch);
    if (this._studyState && oldSeed !== this.options.seed) this.restart();
  }

  restart() {
    if (this.destroyed) return;
    if (this._studyState) {
      this._studyState = createStudyState(this.options.seed, { automatic: this._studyConfig.automatic });
      this._studyAccumulator = 0;
    }
    super.restart();
  }

  pulse() { if (!this.destroyed && this._studyState) this.cueStudy({ type: 'retreat' }); else super.pulse(); }

  destroy() {
    if (this.destroyed) return;
    this.canvas?.removeEventListener('lostpointercapture', this._leave);
    super.destroy();
    this._studyArmBuffer = new Float64Array(0); this._studyQuietPlankton = null;
    this._studyPose = null; this._studyAccumulator = 0;
  }
}

export function createCuttlefishStudy(canvas, study = {}, artwork = {}) {
  return new CuttlefishStudyArtwork(canvas, study, artwork);
}
