const directions = {
  investigate: { target: { x: .22, y: -.12 }, stillSeconds: 2.2 },
  retreat: { target: { x: -.22, y: .08 }, stillSeconds: 1.7 },
};

/** Accessible equivalent of acting on the canvas, with a deliberate still when paused. */
export function activateInkPuppetAction(controller, action, paused) {
  if (controller.destroyed) return 'unavailable';
  controller.setTool(action);
  const { target, stillSeconds } = directions[action];
  if (paused || controller.paused) {
    return controller.showStill(action, stillSeconds, target) ? 'still' : 'unavailable';
  }
  return controller.cue({ type: action, ...target }) ? 'animated' : 'unavailable';
}
