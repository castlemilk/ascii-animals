'use client';

import { useId, useState } from 'react';
import type { RendererSession } from '../lib/renderers';

type Curmudgeon = Extract<RendererSession, { variation: 'reef-curmudgeon' }>['controller'];

const actions = [
  { name: 'Invite closer', method: 'invite' },
  { name: 'Puff up', method: 'approach' },
  { name: 'Give space', method: 'retreat' },
] as const;

export function ReefCurmudgeonControls({ controller }: { controller: Curmudgeon }) {
  const titleId = useId();
  const [notice, setNotice] = useState('');
  return <section className="trickster-controls" aria-labelledby={titleId}>
    <h2 id={titleId}>Meet the Reef Curmudgeon</h2>
    <p>Tap the water to invite it. Or use the controls to see it puff up and settle. In a still view, each action shows a single pose.</p>
    <div className="reaction-buttons">
      {actions.map(({ name, method }) => <button key={method} type="button" className="button quiet"
        onClick={() => {
          const { kind } = controller[method]();
          setNotice(kind === 'static-poster' ? `${name}: still frame shown.`
            : kind === 'queued' ? `${name}: cue sent.`
            : 'The study is not visible. Bring it into view and try again.');
        }}>{name}</button>)}
    </div>
    <p className="reaction-notice" role="status">{notice}</p>
  </section>;
}
