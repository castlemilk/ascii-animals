'use client';

import { useId, useState, type ComponentType } from 'react';
import type { MovementConfig } from 'ascii-animals-review/movement';
import type { MarineMovementArtwork, MarineMovementOptions } from 'ascii-animals-review/movement/marine';
import type { RendererConfigurations, RendererSession } from '../lib/renderers';

export interface MovementPanelProps {
  readonly session: RendererSession;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** The shell, not the panel, owns playback and the reduced-motion policy. */
  readonly requestPaused: (paused: boolean) => void;
}

const paths = [
  ['horizontal', 'Horizontal', 'horizontal', 'down'],
  ['vertical', 'Vertical', 'vertical', 'down'],
  ['diagonal-down', 'Diagonal down', 'diagonal', 'down'],
  ['diagonal-up', 'Diagonal up', 'diagonal', 'up'],
  ['free', 'Wandering', 'free', 'down'],
] as const;

function pathValue(settings: MovementConfig): string {
  return settings.path === 'diagonal' ? `diagonal-${settings.diagonalSlope}` : settings.path;
}

function MarineJourneyPanel({ controller, paused, reducedMotion, requestPaused }: Omit<MovementPanelProps, 'session'> & {
  controller: MarineMovementArtwork;
}) {
  const id = useId();
  const [settings, setSettings] = useState(() => controller.getMovementOptions());
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function perform(action: () => void, message: string) {
    if (controller.disposed) return;
    try {
      action();
      setSettings(controller.getMovementOptions());
      setNotice(message);
      setError('');
    } catch {
      setNotice('');
      setError('The journey could not be updated. The previous settings were kept.');
    }
  }

  function configure(patch: MarineMovementOptions, message = 'Journey settings updated.') {
    perform(() => controller.configureMovement(patch), message);
  }

  return <>
    <p className="eyebrow">Route director</p>
    <h2 id={`${id}-title`}>Across the water</h2>
    <p id={`${id}-help`}>Choose a route. The animal enters from outside the view, crosses it, then leaves. Its usual reactions still work.</p>
    <label className="toggle-label journey-toggle">
      <input type="checkbox" checked={settings.enabled} aria-describedby={`${id}-help`} onChange={event => {
        const enabled = event.currentTarget.checked;
        configure({ enabled }, enabled ? 'Journey enabled.' : 'Natural movement restored.');
      }} />
      <span>Travel across the screen<small>Off keeps the original movement.</small></span>
    </label>
    {settings.enabled && <>
      <fieldset className="journey-settings" aria-labelledby={`${id}-title`}>
        <label>Path
          <select value={pathValue(settings)} onChange={event => {
            const selected = paths.find(path => path[0] === event.currentTarget.value);
            if (selected) configure({ path: selected[2], diagonalSlope: selected[3] });
          }}>
            {paths.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Starting direction
          <select value={settings.direction} onChange={event => configure({
            direction: event.currentTarget.value === 'reverse' ? 'reverse' : 'forward',
          })}>
            <option value="forward">Forward</option><option value="reverse">Reverse</option>
          </select>
        </label>
        <label>Travel time
          <select value={settings.timing.mode === 'duration' ? settings.timing.seconds : 8}
            onChange={event => configure({ timing: { mode: 'duration', seconds: Number(event.currentTarget.value) } })}>
            <option value={4}>4 seconds</option><option value={8}>8 seconds</option><option value={16}>16 seconds</option>
          </select>
        </label>
        <label>Linger halfway
          <select value={settings.lingerSeconds} onChange={event => configure({ lingerSeconds: Number(event.currentTarget.value) })}>
            <option value={0}>Don't linger</option><option value={1}>1 second</option><option value={3}>3 seconds</option>
          </select>
        </label>
      </fieldset>
      <label className="journey-repeat"><input type="checkbox" checked={settings.repeat}
        onChange={event => configure({ repeat: event.currentTarget.checked })} /> Repeat after exit</label>
      <div className="journey-actions">
        <button type="button" className="button quiet" onClick={() => perform(
          () => controller.reverseMovement(), 'Direction reversed without jumping to a new position.',
        )}>Reverse now</button>
        <button type="button" className="button quiet" onClick={() => perform(() => {
          controller.showMovementStill(.5);
          requestPaused(true);
        }, 'Midpoint still shown. Animation is paused.')}>Show midpoint still</button>
      </div>
      {(paused || reducedMotion) && <p className="motion-note">The journey stays still while playback is paused or motion is reduced.</p>}
    </>}
    <p role="status" className="sr-only">{notice}</p>
    {error && <p role="alert" className="motion-note">{error}</p>}
  </>;
}

function MovementPanel(props: MovementPanelProps) {
  const { session } = props;
  if (session.variation !== 'original') return null;
  if (session.species !== 'cuttlefish' && session.species !== 'manta' && session.species !== 'octopus') return null;
  // Only marine session members share this supported pose adapter.
  return <MarineJourneyPanel controller={session.controller} paused={props.paused}
    reducedMotion={props.reducedMotion} requestPaused={props.requestPaused} />;
}

export const movementControls: {
  readonly configuration: Partial<RendererConfigurations>;
  readonly Panel: ComponentType<MovementPanelProps>;
} = { configuration: {}, Panel: MovementPanel };
