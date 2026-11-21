'use client';

import { useId, useState } from 'react';
import type { RendererSession } from '../lib/renderers';

type ActiveStudy = Extract<RendererSession, { variation: 'tidepool-trouper' | 'sunpatch' }>;

export function NatureVariationControls({ session }: { session: ActiveStudy }) {
  const title = useId();
  const [notice, setNotice] = useState('');
  const crab = session.variation === 'tidepool-trouper';
  const acts = session.variation === 'tidepool-trouper' ? [
    ['Find food', () => session.controller.cue('forage')],
    ['Raise claws', () => session.controller.cue('signal')],
    ['Take cover', () => session.controller.cue('shelter')],
  ] as const : [
    ['Invite to flower', () => session.controller.cue('gather')],
    ['Send a breeze', () => session.controller.cue('breeze')],
  ] as const;
  return <section className="trickster-controls" aria-labelledby={title}>
    <h2 id={title}>{crab ? 'Direct the shore crab' : 'Direct the butterfly'}</h2>
    <p>{crab ? 'Tap the shore to forage, or tap a crab glyph to signal. On the stage, use F, S or H.'
      : 'Tap a lower flower to invite a landing or the open air to send a breeze. On the stage, use Enter or B.'} Still mode shows a pose instead of motion.</p>
    <div className="reaction-buttons">
      {acts.map(([name, act]) => <button key={name} type="button" className="button quiet"
        onClick={() => {
          const status = session.controller.getStatus();
          if (!status.inViewport || status.hidden) {
            setNotice('Bring the artwork into view, then try again.');
            return;
          }
          act();
          setNotice(status.paused ? `${name}: still pose shown.` : `${name}: cue sent.`);
        }}>{name}</button>)}
    </div>
    <p className="reaction-notice" role="status">{notice}</p>
  </section>;
}
