import type { ComponentType } from 'react';
import type { RendererConfigurations, RendererSession } from '../lib/renderers';

export interface MovementPanelProps {
  /** Narrow session.species to get the actual native controller type. */
  readonly session: RendererSession;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** Use the shell policy for playback; do not independently resume a controller. */
  readonly requestPaused: (paused: boolean) => void;
}

/**
 * Stable demo-only seam for the movement owner.
 *
 * Configuration is applied before native construction (several existing
 * directors require that). Panel owns its own listeners/subscriptions and must
 * clean them on unmount. The shell owns the sole renderer and its disposal.
 * No movement model, anatomy, second clock, or universal command API lives here.
 * Marine director factory substitution is a named handoff overlap; see README.
 */
export const movementControls: {
  readonly configuration: Partial<RendererConfigurations>;
  readonly Panel: ComponentType<MovementPanelProps> | null;
} = {
  configuration: {},
  Panel: null,
};
