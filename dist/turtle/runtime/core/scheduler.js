/** A framework-neutral, injectable requestAnimationFrame multiplexer. */
export function createScheduler({ requestFrame, cancelFrame, onError = error => { throw error; } }) {
  if (typeof requestFrame !== 'function' || typeof cancelFrame !== 'function') {
    throw new TypeError('createScheduler requires requestFrame and cancelFrame functions.');
  }
  const listeners = new Set();
  const batch = [];
  let pending = null, dispatching = false, disposed = false;
  const schedule = () => {
    if (!disposed && !dispatching && listeners.size && pending === null) pending = requestFrame(frame);
  };
  function frame(timestamp) {
    pending = null;
    if (disposed) return;
    dispatching = true;
    let firstError;
    try {
      // Reuse one snapshot buffer. New subscriptions start on the next frame;
      // removals still take effect immediately during the current dispatch.
      for (const listener of listeners) batch.push(listener);
      for (const listener of batch) {
        if (!listeners.has(listener)) continue;
        try { listener(timestamp); } catch (error) {
          try { onError(error); } catch (reported) { firstError ??= reported; }
        }
      }
    } finally { batch.length = 0; dispatching = false; schedule(); }
    if (firstError !== undefined) throw firstError;
  }
  return {
    subscribe(listener) {
      if (disposed) throw new Error('Cannot subscribe to a disposed scheduler.');
      if (typeof listener !== 'function') throw new TypeError('Subscriber must be a function.');
      // Each subscription owns its removal even when callbacks are identical.
      const entry = timestamp => listener(timestamp);
      listeners.add(entry);
      try { schedule(); } catch (error) { listeners.delete(entry); throw error; }
      let active = true;
      return () => {
        if (!active) return;
        active = false; listeners.delete(entry);
        if (!listeners.size && pending !== null) { cancelFrame(pending); pending = null; }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; listeners.clear();
      if (pending !== null) cancelFrame(pending);
      pending = null;
    },
    get size() { return listeners.size; }
  };
}

// Weak keys allow detached browsing contexts to be collected. No browser globals
// are accessed while importing this module, including on a server.
const browserSchedulers = new WeakMap();
export function getBrowserScheduler(view) {
  let scheduler = browserSchedulers.get(view);
  if (!scheduler) {
    scheduler = createScheduler({
      requestFrame: callback => view.requestAnimationFrame(callback),
      cancelFrame: handle => view.cancelAnimationFrame(handle),
      onError: error => view.setTimeout(() => { throw error; }, 0)
    });
    browserSchedulers.set(view, scheduler);
  }
  return scheduler;
}
