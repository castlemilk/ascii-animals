/** Species-local imports. Central npm/package integration is still pending. */
import { createFox, staticFoxPose } from '../src/model.js';
import { buildFoxGrid } from '../src/preview.js';
import type { FoxCreateOptions, FoxInput, FoxState, FoxStepResult } from '../src/types.js';

const options = {
  seed: 17,
  facing: 'right',
  tailSway: 0.075,
  pounceDistance: 0.2,
  pounceHeight: 0.24,
} satisfies FoxCreateOptions;

/** Replay is driven by explicit ticks, independently of presentation cadence. */
export function runFoxExample(): { state: FoxState; text: string } {
  const fox = createFox(options);
  try {
    for (let tick = 1; tick <= 120; tick++) {
      const inputs: readonly FoxInput[] = tick === 15
        ? [{ type: 'guide', tick, seq: 0, x: 0.7, y: 0.15 }]
        : tick === 60 ? [{ type: 'pounce', tick, seq: 1 }] : [];
      const result: FoxStepResult = fox.step(tick, inputs);
      if (result.kind === 'paused') break;
    }
    const state = fox.getState();
    const text = buildFoxGrid(fox.getPose(), { cols: 112, rows: 44 }).text;
    return { state, text };
  } finally {
    fox.dispose();
  }
}

/** A static alternative for reduced motion or environments without Canvas. */
export function foxPosterText(): string {
  return buildFoxGrid(staticFoxPose(options, 'idle'), {
    cols: 80, rows: 32, monochrome: true,
  }).text;
}

/** Discriminated states make species-specific response telemetry explicit. */
export function describeFoxState(state: FoxState): string {
  switch (state.behavior.kind) {
    case 'idle': return 'Resting; ears alert and paws planted.';
    case 'stalk': return 'Cautiously stepping toward the guide.';
    case 'sniff': return 'Holding position and sniffing.';
    case 'crouch': return `Preparing the pounce, tick ${state.behavior.age}.`;
    case 'airborne': return `In a short leap, tick ${state.behavior.age}.`;
    case 'landing': return 'Landing on the forepaws, with the tail balancing.';
    case 'recover': return 'Settling after the pounce.';
    case 'cooldown': return `Resting for ${state.behavior.remaining} more ticks before another pounce.`;
    default: { const exhaustive: never = state.behavior; return exhaustive; }
  }
}
