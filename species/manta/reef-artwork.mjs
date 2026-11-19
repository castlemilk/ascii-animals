// Species-local study adapter. It consumes the actual built marine package.
// The underscored camera/render seams are review integration details, not a new
// stable package API. Scheduling, input, buffers and disposal stay with the host.
import { CuttlefishArtwork } from '../../lib/animals/cuttlefish.js';
import { normalizeOptions } from '../../lib/public/index.js';
import { normalizeReefOptions, sampleReefPose, REEF_STILLS } from './reef-director.mjs';
import { drawReefHabitat } from './reef-habitat.mjs';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const smooth = n => { const u = clamp(n, 0, 1); return u * u * (3 - 2 * u); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v, fallback = [0, 0, 1]) => { const n = Math.hypot(...v); return n > .00001 ? v.map(x => x / n) : fallback.slice(); };

function validateArtwork(options) {
  normalizeOptions(options); // The study adopts the existing strict typed facade's schema.
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Artwork options must be an object.');
  if (options.species !== undefined && options.species !== 'manta') throw new TypeError('The reef study owns manta only.');
  if (options.count !== undefined && options.count !== 1) throw new RangeError('The reef study contains one manta.');
  if (options.formation !== undefined && options.formation !== 'independent') throw new TypeError('The reef study uses independent formation.');
  if (options.scene !== undefined && options.scene !== 'reactive') throw new TypeError('The reef study uses the reactive host scene.');
  if (options.speciesByAnimal !== undefined && (!Array.isArray(options.speciesByAnimal)
    || options.speciesByAnimal.length > 1 || !Array.from(options.speciesByAnimal).every(value => value === 'manta'))) {
    throw new TypeError('The reef study cannot contain another species.');
  }
  if (options.behaviors !== undefined && (!Array.isArray(options.behaviors) || options.behaviors.length > 1
    || !Array.from(options.behaviors).every(value => ['auto', 'hover', 'curious'].includes(value)))) {
    throw new TypeError('The reef study supports a single hover or curious role.');
  }
}

export class MantaReefArtwork extends CuttlefishArtwork {
  constructor(canvas, reefOptions = {}, artworkOptions = {}) {
    const config = normalizeReefOptions(reefOptions);
    validateArtwork(artworkOptions); // Fail before the host allocates listeners.
    const cleanArtwork = Object.fromEntries(Object.entries(artworkOptions).filter(([, value]) => value !== undefined));
    super(canvas, { scene: 'reactive', species: 'manta', count: 1, behaviors: ['curious'],
      formation: 'independent', size: 1.08, sizeVariation: 0, density: 1.24,
      glow: false, followPointer: true, speed: 1, ripple: 1.1, seed: 17, ...cleanArtwork });
    try {
      this._reefConfig = config;
      this._reefCurrent = { from: config.current, to: config.current, start: this.elapsed };
      this._reefPhaseOffset = 0;
      this._reefSide = 1;
      this._reefStill = null;
      this._reefReady = true;
      this.render();
    } catch (error) { this.destroy(); throw error; }
  }

  _currentAt() {
    const transition = this._reefCurrent;
    if (!transition) return this._reefConfig?.current ?? .45;
    const u = smooth((this.elapsed - transition.start) / 3);
    return transition.from + (transition.to - transition.from) * u;
  }

  _sampleReef() {
    const still = this._reefStill;
    const pose = sampleReefPose({
      time: still ? this._reefConfig.duration * .32 : this.time + this._reefPhaseOffset,
      seed: this.options.seed, current: this._currentAt(),
      pointer: still || !this.options.followPointer ? undefined : { x: this.pointer.x, y: this.pointer.y, interest: this.pointer.interest },
      reactionAge: still ? ({ glide: null, anticipation: .42, bank: 2.6, recover: 5.6 })[still]
        : this.reaction?.active ? this.reaction.age : null,
      side: this._reefSide,
      motion: still ? 1 : Math.min(1, this.options.motion / 1.2),
      aspect: Math.max(.3, this.width / Math.max(1, this.height))
    }, this._reefConfig);
    // A duration edit retimes only travel. Fin phase, habitat and reported
    // playback time keep their existing clock rather than jumping with it.
    if (!still) pose.time = this.time;
    return pose;
  }

  _camera(t) {
    super._camera(t);
    // `super()` performs the initial render before subclass state exists.
    if (!this._reefReady || this.destroyed) return;
    const pose = this._sampleReef();
    this.reefPose = pose;
    this.mantaMotion = { time: pose.time, wingEnergy: pose.wingEnergy,
      turn: pose.turn, lobeOpen: pose.lobeOpen, dihedral: pose.dihedral };
    this.subjectVisibility = 1;
    this.encounterGrip = this.encounterFront = this.escapeAmount = this.startleTension = 0;
    this.phase = pose.phase; this.progress = pose.progress;
    const forward = pose.forward;
    let dorsal = unit(pose.reference.map((v, j) => v - forward[j] * dot(pose.reference, forward)));
    let lateral = unit(cross(dorsal, forward), [1, 0, 0]);
    const cb = Math.cos(pose.bank), sb = Math.sin(pose.bank), l = lateral, z = dorsal;
    lateral = l.map((v, j) => v * cb - z[j] * sb);
    dorsal = z.map((v, j) => v * cb + l[j] * sb);
    [this.r00, this.r10, this.r20] = forward;
    [this.r01, this.r11, this.r21] = lateral;
    [this.r02, this.r12, this.r22] = dorsal;
    const light = [-.38, -.48, .790], half = [-.204, -.258, .944];
    this.lx = dot(forward, light); this.ly = dot(lateral, light); this.lz = dot(dorsal, light);
    this.hx = dot(forward, half); this.hy = dot(lateral, half); this.hz = dot(dorsal, half);
    this.vx = this.r20; this.vy = this.r21; this.vz = this.r22;
    this.objectScale = this.activeFish.size;
    const position = pose.position.slice(), b = this.activeFish.definition.bounds;
    if (this.perspectiveStrength > 0) {
      const front = (Math.max((b.minX - .30) * this.r20, (b.maxX - .30) * this.r20)
        + b.maxY * Math.abs(this.r21) + b.maxZ * Math.abs(this.r22)) * this.objectScale;
      position[2] = Math.min(position[2], .72 / this.perspectiveStrength - front);
    }
    [this.worldX, this.worldY, this.worldZ] = position;
    this.scale = Math.min(this.width / 8, this.height / 6.8);
    this.cx = this.width * .5; this.cyScreen = this.height * .45;
    const radius = this.objectScale * this.scale / Math.max(.24, 1 - this.worldZ * this.perspectiveStrength);
    this.geometryStep = radius > 105 ? 1 : radius > 46 ? 2 : 3;
    // The parent draws the opaque water before calling _camera inside render.
    // A species-local habitat hook therefore draws behind the canonical glyphs.
    // Simulation and input calls to _camera must never draw the backdrop.
    if (this._reefRendering && this._reefConfig.habitat) this.drawReefHabitat?.(pose);
  }

  render() {
    const previous = this._reefRendering;
    const playbackTime = this.time;
    this._reefRendering = Boolean(this._reefReady);
    // The host's water particles also use `time`; a representative still must
    // have one fixed presentation time without advancing the playback clock.
    if (this._reefReady && this._reefStill) this.time = this._reefConfig.duration * .32;
    try { super.render(); } finally { this.time = playbackTime; this._reefRendering = previous; }
  }

  drawReefHabitat(pose) { drawReefHabitat(this, pose); }

  setReef(patch) {
    if (this.destroyed) return;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Reef options must be an object.');
    // Normalize the patch separately so undefined means omitted on updates.
    normalizeReefOptions(patch);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const next = normalizeReefOptions({ ...this._reefConfig, ...clean });
    if (next.current !== this._reefConfig.current) {
      this._reefCurrent = { from: this.paused ? next.current : this._currentAt(), to: next.current, start: this.elapsed };
    }
    if (next.duration !== this._reefConfig.duration) {
      this._reefPhaseOffset = (this.time + this._reefPhaseOffset) * next.duration / this._reefConfig.duration - this.time;
    }
    this._reefConfig = next;
    this.render();
  }

  getReef() {
    const pose = this._sampleReef();
    return Object.freeze({ options: this._reefConfig, current: pose.current, clock: pose.time,
      responseAge: pose.reactionAge, side: pose.side, phase: pose.phase, stage: pose.stage,
      sequence: pose.sequence, still: this._reefStill });
  }

  _startleFish(reason) {
    const side = this._requestedBankSide ?? (this.pointer.tx < 0 ? -1 : 1);
    const accepted = super._startleFish(reason);
    if (accepted && this._reefReady) { this._reefSide = side; this._reefStill = null; }
    return accepted;
  }

  bank(side = 1) {
    if (this.destroyed) return false;
    if (side !== -1 && side !== 1) throw new RangeError('Bank side must be -1 or 1.');
    if (this.paused) { this._reefSide = side; return this.showReefStill('bank'); }
    if (this.fish[0].reaction.active) return false;
    this._requestedBankSide = side;
    try { return this._startle('manta-bank', 0); } finally { this._requestedBankSide = undefined; }
  }

  showReefStill(still) {
    if (this.destroyed) return false;
    if (!REEF_STILLS.includes(still)) throw new TypeError('Unknown reef still.');
    this.setPaused(true);
    this._reefStill = still;
    this._reefCurrent = { from: this._reefConfig.current, to: this._reefConfig.current, start: this.elapsed };
    this.ink.length = 0; this.burst = 0;
    for (const fish of this.fish) {
      fish.reaction = this._newReaction();
      fish.agitation = fish.movingTime = fish.motionTravel = fish.motionTurns = 0;
      fish.motionVector = null; fish.lastMotionAt = 0;
      fish.startleTension = fish.escapeAmount = fish.encounterGrip = fish.encounterFront = 0;
    }
    this._activateFish(this.fish[0]);
    this.pointer.x = this.pointer.y = this.pointer.tx = this.pointer.ty = 0;
    this.pointer.interest = 0; this.pointer.active = false; this.lastPointer = null;
    this.render();
    return true;
  }

  setPaused(value) {
    if (this.destroyed) return;
    if (!value && this._reefReady) this._reefStill = null;
    super.setPaused(value);
  }

  setOptions(patch) {
    if (this.destroyed) return;
    validateArtwork(patch);
    if (patch.paused === false && this._reefReady) this._reefStill = null;
    super.setOptions(patch);
  }

  setDirector(options) {
    if (this.destroyed) return;
    if (options !== null) throw new TypeError('Use setReef for the manta reef study.');
    super.setDirector(null);
  }

  restart() {
    if (this.destroyed) return;
    if (this._reefReady) {
      this._reefStill = null; this._reefSide = 1;
      this._reefPhaseOffset = 0;
      this._reefCurrent = { from: this._reefConfig.current, to: this._reefConfig.current, start: 0 };
    }
    super.restart();
  }
}

export function createMantaReef(canvas, reefOptions = {}, artworkOptions = {}) {
  return new MantaReefArtwork(canvas, reefOptions, artworkOptions);
}
