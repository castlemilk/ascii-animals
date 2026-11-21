import type { InkPuppetAction, InkPuppetController } from './ink-puppet.mjs';

export function activateInkPuppetAction(
  controller: InkPuppetController, action: InkPuppetAction, paused: boolean,
): 'animated' | 'still' | 'unavailable';
