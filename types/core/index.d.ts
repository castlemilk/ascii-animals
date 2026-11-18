/** Animation-frame timestamp in milliseconds, as supplied by the host. */
export type FrameCallback = (timestampMs: number) => void;

export interface SchedulerOptions {
  requestFrame: (callback: FrameCallback) => number;
  cancelFrame: (id: number) => void;
  onError?: (error: unknown) => void;
}

export interface Scheduler {
  /** Register once; the returned unsubscribe function is idempotent. */
  subscribe(callback: FrameCallback): () => void;
  dispose(): void;
  readonly size: number;
}

/** No DOM globals are read. The host owns the injected scheduling functions. */
export function createScheduler(options: SchedulerOptions): Scheduler;
