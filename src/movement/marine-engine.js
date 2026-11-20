/**
 * Internal bridge pinned to the marine renderer's pose/lifecycle hooks.
 * Deliberately separate from eye, geometry and rasterization implementations.
 * This is not an arbitrary-species renderer extension API.
 */
import { CuttlefishArtwork } from '../animals/cuttlefish.js';
import { normalizeOptions } from '../public/index.js';
import { createMovementDirector, normalizeMovementOptions } from '../public/movement.js';

const RESERVED = new Set(['count', 'cast', 'profile', 'silhouetteRadius']);
function validateMovementPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Movement options must be an object.');
  for (const key of Object.keys(patch)) {
    if (RESERVED.has(key)) throw new TypeError(`${key} is derived from the marine artwork, not a movement option.`);
  }
  return patch;
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class MovementMarineEngine extends CuttlefishArtwork {
  constructor(canvas, movement = {}, artwork = {}) {
    const config = normalizeOptions(artwork);
    normalizeMovementOptions(validateMovementPatch(movement)); // Validate before Canvas/listener allocation.
    const { paused: ignored, ...initial } = config;
    super(canvas, artwork.paused === undefined ? initial : { ...initial, paused: artwork.paused });
    try {
      this._journeyUserPaused = artwork.paused ?? false;
      this._journeyMotionLatch = this._systemReduced();
      this._journeyRemainder = 0;
      this._journeySkipRender = false;
      this._journeyPoster = null;
      this._journey = createMovementDirector({ ...movement, ...this._castMovementOptions(movement.edgePadding ?? 24) }, this._movementViewport());
      this._journeyFrame = this._journey.sample();
      // Replace, rather than duplicate, the inherited media-query handler.
      this._motionQuery?.removeEventListener?.('change', this._motionChange);
      this._motionChange = () => {
        if (this._systemReduced()) this._journeyMotionLatch = true;
        this._reconcileMovementPause();
        if (this._systemReduced()) this._composePoster(.5);
        this.render();
      };
      this._motionQuery?.addEventListener?.('change', this._motionChange);
      this._reconcileMovementPause();
      if (this.paused && this._journey.getOptions().enabled) this._composePoster(.5);
      this.render();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  _systemReduced() { return this.options.reducedMotion === 'system' && Boolean(this._motionQuery?.matches); }
  _movementViewport() { return { width: this.width || 0, height: this.height || 0 }; }
  _castMovementOptions(edgePadding = this._journey?.getOptions().edgePadding ?? 24) {
    const cast = this.fish.map(fish => fish.species);
    const depth = clamp(this.options.depthStrength, 0, 2);
    const lens = .28 * depth / (1 + .55 * depth);
    const denominator = 1 + .8 * lens;
    const scale = Math.min(this.width / (this.fish.length === 1 && cast[0] !== 'cuttlefish' ? 8 : 9.8), this.height / 6.8);
    // Conservative sphere includes arms, fins, local-X centering and native
    // pose changes. Perspective changes the projection of the *centre* too;
    // the viewport term keeps the whole silhouette beyond the exit edge.
    const bound = Math.max(...this.fish.map(fish => {
      const b = fish.definition?.bounds;
      const radius = b ? Math.hypot(Math.max(Math.abs(b.minX - .3), Math.abs(b.maxX - .3)), b.maxY, b.maxZ)
        : Math.hypot(2.8, 1.8, 1.4);
      return fish.size * radius;
    }));
    const viewportExtent = Math.max(this.width * .5, this.height * .52);
    const radius = Math.ceil((bound * (scale + (viewportExtent + edgePadding) * lens) / denominator) + scale * .5 + 4);
    return { count: cast.length, cast, silhouetteRadius: Math.min(8192, Math.max(4, radius)) };
  }

  _legacySingle() {
    return this._journey?.getOptions().enabled ? false : super._legacySingle();
  }

  _schoolPose(t) {
    if (!this._journey?.getOptions().enabled) return super._schoolPose(t);
    const sample = (this._journeyPoster ?? this._journeyFrame).members[this.activeFish.id];
    const definition = this.activeFish.definition;
    const scale = Math.min(this.width / (definition && this.fish.length === 1 ? 8 : 9.8), this.height / 6.8);
    const z = -.8;
    const lens = .28 * this.depthAmount / (1 + .55 * this.depthAmount);
    const denominator = 1 - z * lens;
    const inverseScale = denominator / Math.max(.0001, scale);
    const position = [(sample.x - this.width * .5) * inverseScale, (sample.y - this.height * .48) * inverseScale, z];
    // The reactive scene's old curious offsets lived in _schoolPose. Retain a
    // bounded local invitation here; native disturbance/recovery wins later.
    if (this.options.scene === 'reactive' && this.options.followPointer) {
      const envelope = Math.sin(Math.PI * clamp(sample.progress, 0, 1));
      position[0] += this.pointer.x * .3 * envelope;
      position[1] += this.pointer.y * .18 * envelope;
    }
    const dz = this.activeFish.species === 'cuttlefish' ? .12 : .035;
    const length = Math.hypot(1, dz);
    const forward = [Math.cos(sample.heading) / length, Math.sin(sample.heading) / length, dz / length];
    this.phase = `Journey · ${sample.phase}`;
    this.progress = sample.progress;
    // Matching the rest anchor keeps the library's local motion strength from
    // shrinking an across-screen route into the middle of the viewport.
    return { position, forward, bank: 0, anchor: [...position] };
  }

  _camera(t) {
    if (!this._journey?.getOptions().enabled) return super._camera(t);
    const fish = this.activeFish, behavior = fish.behavior;
    // The native portrait roles intentionally ignore school headings. Travel
    // borrows cruise orientation while preserving the saved role, articulation,
    // attention and species-specific reaction code in the base camera.
    fish.behavior = 'cruise';
    try { super._camera(t); } finally { fish.behavior = behavior; }
  }

  _simulate(dt) {
    if (!this._journey?.getOptions().enabled) return super._simulate(dt);
    // Manual advance is an explicit recording operation and may ignore pause;
    // the system reduced-motion policy remains a hard stop for this adapter.
    if (this._systemReduced()) { this.render(); return; }
    this._journeyRemainder += dt * 60;
    const ticks = Math.min(6, Math.floor(this._journeyRemainder + 1e-9));
    this._journeyRemainder = Math.max(0, this._journeyRemainder - ticks);
    if (!ticks) { this.render(); return; }
    this._journeyPoster = null;
    this._journeySkipRender = true;
    try {
      for (let i = 0; i < ticks; i++) {
        this._journey.advanceTicks(1);
        this._journeyFrame = this._journey.sample();
        super._simulate(1 / 60);
      }
    } finally { this._journeySkipRender = false; }
    this.render();
  }

  render() {
    if (this._journeySkipRender) return;
    super.render();
  }

  resize() {
    if (!this._journey || this.destroyed) return super.resize();
    this._journeySkipRender = true;
    try {
      super.resize();
      this._journey.configure(this._castMovementOptions());
      this._journey.resize(this._movementViewport());
      this._journeyFrame = this._journey.sample();
      if (this._journeyPoster) this._composePoster(this._journeyPosterProgress);
    } finally { this._journeySkipRender = false; }
    this.render();
  }

  _reconcileMovementPause() {
    const paused = this._journeyUserPaused || this._journeyMotionLatch || this._systemReduced();
    super.setPaused(paused);
    this._syncLoop();
  }
  setPaused(value) {
    if (this.destroyed) return;
    if (!this._journey) return super.setPaused(value);
    this._journeyUserPaused = Boolean(value);
    if (!value && !this._systemReduced()) this._journeyMotionLatch = false;
    this._reconcileMovementPause();
    if (!this.paused) this._journeyPoster = null;
    this.render();
  }
  _shouldRun() { return super._shouldRun() && !this._systemReduced(); }

  setOptions(patch) {
    if (this.destroyed) return;
    // Same strict schema as the public marine facade; reject before mutation.
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('Artwork options must be an object.');
    normalizeOptions(patch);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const next = normalizeOptions({ ...this.options, ...clean });
    this._journeySkipRender = true;
    try {
      const { paused, ...withoutPause } = next;
      super.setOptions(withoutPause);
      if (patch.paused !== undefined) this._journeyUserPaused = patch.paused;
      const reduced = this._systemReduced();
      if (reduced) this._journeyMotionLatch = true;
      else if (patch.paused === false) this._journeyMotionLatch = false;
      if (this._journey) {
        this._journey.configure(this._castMovementOptions());
        this._journeyFrame = this._journey.sample();
        this._reconcileMovementPause();
        if (!this.paused) this._journeyPoster = null;
        else if (this._journeyPoster || reduced) this._composePoster(this._journeyPosterProgress ?? .5);
      }
    } finally { this._journeySkipRender = false; }
    this.render();
  }

  getStats() {
    const stats = super.getStats();
    if (!this._journey?.getOptions().enabled) return stats;
    const member = (this._journeyPoster ?? this._journeyFrame).members[0];
    return { ...stats, phase: stats.reactionStage === 'idle' ? `Journey · ${member.phase}` : stats.phase, progress: member.progress };
  }
  getArtworkOptions() {
    return normalizeOptions({ ...this.options, paused: this.paused });
  }
  getMovementOptions() { return this._journey.getOptions(); }
  getMovementState() { return this._journey.sample(); }
  getMovementDisplay() { return this._journeyPoster ?? this._journeyFrame; }
  get userPaused() { return Boolean(this._journeyUserPaused); }
  get reducedMotion() { return this._systemReduced(); }

  configureMovement(patch) {
    if (this.destroyed) return;
    validateMovementPatch(patch);
    normalizeMovementOptions(patch);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const next = normalizeMovementOptions({ ...this._journey.getOptions(), ...clean });
    this._journey.configure({ ...clean, ...this._castMovementOptions(next.edgePadding) });
    this._journeyFrame = this._journey.sample();
    if (this.paused || this._systemReduced()) this._composePoster(this._journeyPosterProgress ?? .5);
    else this._journeyPoster = null;
    this.render();
  }
  reverseMovement() {
    if (this.destroyed) return;
    this._journey.reverse();
    this._journeyFrame = this._journey.sample();
    if (this._journeyPoster) this._composePoster(this._journeyPosterProgress);
    this.render();
  }
  seekMovement(tick) {
    if (this.destroyed) return;
    this._journey.seek(tick);
    this._journeyFrame = this._journey.sample();
    this._journeyRemainder = 0;
    this._journeyPoster = null;
    this.render();
  }
  _composePoster(progress) {
    if (!this._journey) return;
    const poster = createMovementDirector({ ...this._journey.getOptions(), staggerSeconds: 0, repeat: false }, this._movementViewport());
    const frame = poster.sample();
    poster.seek(Math.round(frame.durationTicks * progress));
    if (this._journey.getState().playbackDirection === -1) poster.reverse();
    this._journeyPoster = poster.sample();
    this._journeyPosterProgress = progress;
    poster.dispose();
  }
  showMovementStill(progress = .5) {
    if (this.destroyed) return;
    if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 1) throw new RangeError('Still progress must be 0..1.');
    this.setPaused(true);
    this._composePoster(progress);
    // A deliberate still clears transient escape/ink, never starts a reaction.
    this.ink.length = 0;
    for (const fish of this.fish) fish.reaction = this._newReaction();
    this.render();
  }
  restart() {
    if (this.destroyed) return;
    if (this._journey) {
      this._journey.reset();
      this._journeyFrame = this._journey.sample();
      this._journeyRemainder = 0;
      this._journeyPoster = null;
      if (this.paused) this._composePoster(.5);
    }
    super.restart();
  }
  destroy() {
    this._journey?.dispose();
    super.destroy();
  }
}
