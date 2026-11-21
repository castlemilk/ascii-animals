'use client';

import { useId, useState } from 'react';
import { activateInkPuppetAction } from '../lib/ink-puppet-actions.mjs';
import type { InkPuppetAction, InkPuppetController } from '../lib/ink-puppet.mjs';

export function InkPuppetControls({ controller, paused }: { controller: InkPuppetController; paused: boolean }) {
  const titleId = useId();
  const [notice, setNotice] = useState('');

  function act(action: InkPuppetAction) {
    const result = activateInkPuppetAction(controller, action, paused);
    const name = action === 'investigate' ? 'Investigate' : 'Ink and retreat';
    setNotice(result === 'still' ? `${name} still frame. Playback stays paused.`
      : result === 'animated' ? `${name} started. Tap the artwork to aim this action.`
      : `${name} selected for the next tap. Try the action when the artwork is visible and settled.`);
  }

  // Use the alternate study's existing panel styles, not a second visual system.
  return <section className="trickster-controls" aria-labelledby={titleId}>
    <h2 id={titleId}>Meet the Ink Puppet</h2>
    <p>Invite a closer look or send it jetting away. Choose an action, then tap the artwork to aim it.</p>
    <div className="playback-buttons">
      <button className="button quiet" type="button" onClick={() => act('investigate')}>Investigate</button>
      <button className="button quiet" type="button" onClick={() => act('retreat')}>Ink and retreat</button>
    </div>
    {paused && <p>Actions show a still frame while playback is paused.</p>}
    <p className="reaction-notice" role="status">{notice}</p>
  </section>;
}
