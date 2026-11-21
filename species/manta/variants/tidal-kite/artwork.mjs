// Private opt-in alternative. Original keeps its source, definition and defaults.
// One inherited renderer owns the canvas, scheduler, buffers and observers.
import { MantaReefArtwork } from '../../reef-artwork.mjs';
import { normalizeOptions } from '../../../../lib/public/index.js';
import { mantaDefinition } from './geometry.mjs';
import { sampleReefPose, REEF_STILLS, REEF_INVITATION_SECONDS } from './reef-director.mjs';
import { drawReefHabitat } from './reef-habitat.mjs';
import { buildKiteAtlas } from './kite-rendering.mjs';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const invitationTarget = () => Object.freeze({ x: .32, y: -.12 });
function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Artwork options must be an object.');
  normalizeOptions(options); // Reject unknown keys before super allocates resources.
}

export class MantaTidalKiteArtwork extends MantaReefArtwork {
  constructor(canvas, reefOptions = {}, artworkOptions = {}) {
    validateOptions(artworkOptions);
    const clean = Object.fromEntries(Object.entries(artworkOptions).filter(([, value]) => value !== undefined));
    // Original validates its one-manta restrictions before constructing the host.
    super(canvas, reefOptions, { density: .82, ...clean });
    try {
      this._reefInvitation = null;
      this._reefInviteTarget = invitationTarget();
      this._reefTap = null;
      this._tidalRestoreCanvas = [];
      // Keep an explicit caller policy; restore only changes this instance owns.
      if (canvas.style && !canvas.style.touchAction) {
        const previous = canvas.style.touchAction;
        canvas.style.touchAction = 'pan-y';
        this._tidalRestoreCanvas.push(() => { if (canvas.style.touchAction === 'pan-y') canvas.style.touchAction = previous; });
      }
      if (canvas.getAttribute?.('tabindex') === null) {
        canvas.setAttribute('tabindex', '0');
        this._tidalRestoreCanvas.push(() => { if (canvas.getAttribute('tabindex') === '0') canvas.removeAttribute('tabindex'); });
      }
      this.canvas.removeEventListener('pointerdown', this._touch);
      this._touch = event => this._beginReefTap(event);
      this._reefTapUp = event => this._endReefTap(event);
      this._reefTapCancel = () => { this._reefTap = null; };
      this._tidalKey = event => this._keyDown(event);
      this.canvas.addEventListener('pointerdown', this._touch, { passive: true });
      this.canvas.addEventListener('pointerup', this._reefTapUp, { passive: true });
      for (const type of ['pointercancel', 'pointerleave', 'lostpointercapture']) {
        this.canvas.addEventListener(type, this._reefTapCancel, { passive: true });
      }
      this.canvas.addEventListener('keydown', this._tidalKey);
      if (this._reefReducedMotion()) this.showReefStill('glide');
      this.render();
    } catch (error) { this.destroy(); throw error; }
  }

  _syncFish(reset = false, changedRoles = []) {
    // This hook also runs during super(), restart and option changes. The host
    // reassigns canonical definitions each time, so restore this instance's
    // alternative every time; preserve reusable state without global mutation.
    this._tidalStates ??= new WeakSet();
    super._syncFish(reset, changedRoles);
    for (const fish of this.fish) {
      if (!this._tidalStates.has(fish.speciesState)) {
        fish.speciesState = mantaDefinition.create(fish.speciesState.seed);
        this._tidalStates.add(fish.speciesState);
      }
      fish.definition = mantaDefinition;
    }
  }

  makeAtlas() { buildKiteAtlas(this); }
  drawReefHabitat(pose) { drawReefHabitat(this, pose); }

  _reefReducedMotion() {
    return this.options?.reducedMotion === 'system' && Boolean(this._motionQuery?.matches);
  }
  _shouldRun() { return !this._reefReducedMotion() && super._shouldRun(); }
  _simulate(dt) { if (!this._reefReducedMotion()) super._simulate(dt); }

  _invitationAt() {
    const invitation = this._reefInvitation;
    if (!invitation) return null;
    const age = Math.max(0, this.elapsed - invitation.start);
    return age < REEF_INVITATION_SECONDS ? { ...invitation.target, age } : null;
  }

  _acceptsReefInput() {
    return !this.destroyed && !this._document.hidden && this.width > 0 && this.height > 0
      && (!this.options.observeVisibility || this._inView);
  }

  _beginReefTap(event) {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    this._reefTap = null;
    if (!this._acceptsReefInput() || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (event.clientX - rect.left) * this.width / rect.width;
    const y = (event.clientY - rect.top) * this.height / rect.height;
    if (x < 0 || y < 0 || x > this.width || y > this.height) return;
    const fish = this.fish[0], center = this._projectWorld(fish.worldX, fish.worldY, fish.worldZ);
    this._reefTap = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
      owner: this._hitFish(x, y), side: x < center[0] ? -1 : 1, moved: false };
  }

  _endReefTap(event) {
    const tap = this._reefTap;
    if (!tap || (tap.id !== undefined && event.pointerId !== tap.id)) return;
    this._reefTap = null;
    if (!this._acceptsReefInput() || tap.moved || event.isPrimary === false) return;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)
      || Math.hypot(event.clientX - tap.clientX, event.clientY - tap.clientY) > 10) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
    const y = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
    this.pointer.tx = x; this.pointer.ty = y;
    // Ownership is frozen at press time; moving wings cannot turn a hit into
    // an empty-water invitation between press and release.
    if (tap.owner >= 0) this.bank(tap.side);
    else this.invite({ x, y });
  }

  _pointerMove(event) {
    if (!this._reefReady) { super._pointerMove(event); return; }
    const tap = this._reefTap;
    if (tap && (tap.id === undefined || event.pointerId === tap.id)
      && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      && Math.hypot(event.clientX - tap.clientX, event.clientY - tap.clientY) > 10) tap.moved = true;
    if (!this._acceptsReefInput() || this.paused || this._reefReducedMotion()) return;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.pointer.tx = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
    this.pointer.ty = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
    this.pointer.active = true;
    this.lastPointer = null; // No wall-clock velocity startle replaces a moment.
  }

  _keyDown(event) {
    if (!this._acceptsReefInput() || this._document.activeElement !== this.canvas || event.target !== this.canvas
      || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    if (typeof key !== 'string') return;
    if (key === 'ArrowLeft' || key === 'ArrowRight') this.bank(key === 'ArrowLeft' ? -1 : 1);
    else if (key === 'ArrowUp' || key === 'ArrowDown') this.invite({ x: 0, y: key === 'ArrowUp' ? -.3 : .25 });
    else if (key.toLowerCase() === 'g') this.invite({ x: event.shiftKey ? -.32 : .32, y: -.15 });
    else if (key === ' ' || key === 'Enter') this.setPaused(!this.paused);
    else if (key === 'Escape') this.setPaused(true);
    else return;
    event.preventDefault();
  }

  _sampleReef() {
    const still = this._reefStill;
    const pose = sampleReefPose({
      time: still ? this._reefConfig.duration * .32 : this.time + this._reefPhaseOffset,
      seed: this.options.seed, current: this._currentAt(),
      pointer: still || !this.options.followPointer ? undefined : { x: this.pointer.x, y: this.pointer.y, interest: this.pointer.interest },
      reactionAge: still ? ({ glide: null, anticipation: .42, bank: 2.7, recover: 5.6, invite: null })[still]
        : this.reaction?.active ? this.reaction.age : null,
      invitation: still === 'invite' ? { ...(this._reefInviteTarget || invitationTarget()), age: 2.7 } : still ? null : this._invitationAt(),
      side: this._reefSide,
      motion: still ? 1 : Math.min(1, this.options.motion / 1.2),
      aspect: Math.max(.3, this.width / Math.max(1, this.height))
    }, this._reefConfig);
    if (!still) pose.time = this.time;
    return pose;
  }

  _camera(t) {
    super._camera(t); // Reuse the Original camera, bounds, projection and basis.
    if (this._reefReady && !this.destroyed) {
      this.mantaMotion.wingLoad = this.reefPose.wingLoad;
      this.mantaMotion.wingFold = this.reefPose.wingFold;
    }
  }

  getReef() {
    const pose = this._sampleReef();
    return Object.freeze({ options: this._reefConfig, current: pose.current, clock: pose.time,
      responseAge: pose.reactionAge, side: pose.side, phase: pose.phase, stage: pose.stage,
      sequence: pose.sequence, still: this._reefStill,
      invitationAge: pose.invitationAge,
      invitationTarget: pose.invitationTarget ? Object.freeze({ ...pose.invitationTarget }) : null,
      busy: !this._reefStill && (pose.reactionAge !== null || pose.invitationAge !== null),
      reducedMotion: this._reefReducedMotion() });
  }

  _startleFish(reason) {
    if (this._reefReady && (reason === 'disturbance' || this._invitationAt())) return false;
    const accepted = super._startleFish(reason);
    if (accepted && this._reefReady) this._reefInvitation = null;
    return accepted;
  }

  bank(side = 1) {
    if (this.destroyed) return false;
    if (side !== -1 && side !== 1) throw new RangeError('Bank side must be -1 or 1.');
    if (!this.paused && this._invitationAt()) return false;
    return super.bank(side);
  }

  invite(target) {
    if (this.destroyed) return false;
    if (!target || typeof target !== 'object' || Array.isArray(target)
      || Object.keys(target).some(key => !['x', 'y'].includes(key))) throw new TypeError('An invitation needs only x and y.');
    if (![target.x, target.y].every(value => Number.isFinite(value) && value >= -.5 && value <= .5)) {
      throw new RangeError('Invitation coordinates must be finite numbers from -0.5 to 0.5.');
    }
    if (!this.paused && (this.fish[0].reaction.active || this._invitationAt())) return false;
    this._reefInviteTarget = Object.freeze({ x: target.x, y: target.y });
    if (this.paused || this._reefReducedMotion()) return this.showReefStill('invite');
    this._reefStill = null;
    this._reefInvitation = { start: this.elapsed, target: this._reefInviteTarget };
    this.render();
    return true;
  }

  showReefStill(still) {
    if (this.destroyed) return false;
    if (!REEF_STILLS.includes(still)) throw new TypeError('Unknown reef still.');
    this._reefInvitation = null; this._reefTap = null;
    // Reuse the Original's reaction/pointer/clock reset; only the new still
    // requires a second presentation draw, with no simulation between draws.
    const accepted = super.showReefStill(still === 'invite' ? 'glide' : still);
    if (still === 'invite') { this._reefStill = still; this.render(); }
    return accepted;
  }

  setPaused(value) { super.setPaused(Boolean(value) || this._reefReducedMotion()); }
  setOptions(patch) {
    if (this.destroyed) return;
    validateOptions(patch);
    const reduced = (patch.reducedMotion ?? this.options.reducedMotion) === 'system' && Boolean(this._motionQuery?.matches);
    super.setOptions(reduced ? { ...patch, paused: true } : patch);
  }

  restart() {
    if (this.destroyed) return;
    this._reefInvitation = null; this._reefTap = null;
    this._reefInviteTarget = invitationTarget();
    super.restart();
  }

  // Future host adoption can use the common playback lifecycle on this one
  // instance. Dispose the previous selection before constructing its replacement.
  get disposed() { return this.destroyed; }
  play() { this.setPaused(false); }
  pause() { this.setPaused(true); }
  dispose() { this.destroy(); }

  destroy() {
    if (this.destroyed) return;
    this._reefTap = null;
    if (this._reefTapUp) this.canvas.removeEventListener('pointerup', this._reefTapUp);
    if (this._reefTapCancel) for (const type of ['pointercancel', 'pointerleave', 'lostpointercapture']) {
      this.canvas.removeEventListener(type, this._reefTapCancel);
    }
    if (this._tidalKey) this.canvas.removeEventListener('keydown', this._tidalKey);
    this._tidalRestoreCanvas?.splice(0).forEach(restore => restore());
    super.destroy();
  }
}

export function createMantaTidalKite(canvas, reefOptions = {}, artworkOptions = {}) {
  return new MantaTidalKiteArtwork(canvas, reefOptions, artworkOptions);
}
