/** Independent presentation port: the caller translates these values to its
 * actual movement controller. This is not a new species/renderer interface. */
export interface MovementControlOptions {
  enabled: boolean;
  path: 'horizontal' | 'vertical' | 'diagonal' | 'free';
  direction: 'forward' | 'reverse';
  timing: 'duration' | 'speed';
  durationSeconds: number;
  speedPixelsPerSecond: number;
  lingerSeconds: number;
  repeat: boolean;
  edgePadding: number;
  lanes: number;
  staggerSeconds: number;
  seed: number;
}
export interface MovementControlState extends Readonly<MovementControlOptions> {
  /** Effective pause. The host must compose user pause with its motion policy. */
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** Short human-readable status. Refresh on actions, never every frame. */
  readonly status: string;
}
export interface MovementControlsPort {
  getMovementControls(): MovementControlState;
  /** Validate and apply atomically; throw on invalid input. */
  configureMovementControls(patch: Partial<MovementControlOptions>): void;
  /** Must respect reduced motion, hidden/offscreen and disposal state. */
  toggleMovementPause(): void;
  /** Reverse from the current pose without jumping or resuming playback. */
  reverseMovement(): void;
  /** Restart without changing pause/reduced-motion policy. */
  restartMovement(): void;
  /** Deliberate still at normalized progress; never starts animation. */
  showMovementStill(progress: number): void;
}
export interface MovementControls {
  /** Call after external controller changes and live motion preference changes.
   * There are no timers or frame subscriptions inside the view. */
  refresh(): void;
  /** Remove only this view's DOM/listeners; leave the controller and host alive. */
  dispose(): void;
}
/** Mount after a browser host exists. Multiple instances and SSR import are safe.
 * The caller owns the artwork lifetime and disposes this view on route unmount.
 * The sample deliberately offers at most three lanes for its three-member cast.
 * Include controls.css once in the enclosing page or framework stylesheet. */
export function mountMovementControls(host: HTMLElement, port: MovementControlsPort): MovementControls;
