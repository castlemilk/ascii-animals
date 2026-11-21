/** One bounded bridge from controls below the scene to the controller's visibility gate. */
export function createVisibleActionRunner({ canvas, controller, view, document, announce }) {
  let pending = null, disposed = false;
  function clear() {
    const owned = pending; pending = null;
    if (!owned) return;
    owned.observer?.disconnect();
    if (owned.frame !== null) view.cancelAnimationFrame(owned.frame);
    if (owned.deadline !== null) view.clearTimeout(owned.deadline);
  }
  function available() {
    const status = controller.getStatus(), rect = canvas.getBoundingClientRect();
    return !document.hidden && !status.disposed && !status.offscreen && !status.zeroSize &&
      rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
      rect.top < view.innerHeight && rect.left < view.innerWidth;
  }
  function run(action) {
    clear();
    if (disposed || document.hidden || controller.getStatus().disposed) return false;
    if (available()) { action(); return true; }
    const request = { action, observer: null, frame: null, deadline: null, retried: false };
    pending = request;
    const tryRun = () => {
      if (pending !== request || disposed) return;
      if (document.hidden || controller.getStatus().disposed) { clear(); return; }
      if (available()) { clear(); action(); return; }
      if (!request.retried) {
        request.retried = true;
        request.frame = view.requestAnimationFrame(() => { request.frame = null; tryRun(); });
      }
    };
    if (typeof view.IntersectionObserver === 'function') {
      request.observer = new view.IntersectionObserver(entries => {
        if (entries.some(entry => entry.target === canvas && entry.isIntersecting)) tryRun();
      });
      request.observer.observe(canvas);
    }
    request.deadline = view.setTimeout(() => {
      if (pending !== request) return;
      clear(); announce('The scene is not visible yet. Bring it into view and try again.');
    }, 1200);
    canvas.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
    tryRun();
    return false;
  }
  return Object.freeze({ run, cancel: clear, dispose() { if (disposed) return; disposed = true; clear(); } });
}
