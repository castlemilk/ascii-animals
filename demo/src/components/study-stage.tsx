'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BASE_PATH, apiPath, originalPath, type Animal } from '../lib/catalogue';
import { isMarineSpecies, mountRenderer, type RendererSession } from '../lib/renderers';
import { movementControls } from '../extensions/movement-controls';
import { useMotionPolicy } from './motion-policy';
import { availableVariations, hasVariations, readVariation, variationHref, type VariationId } from '../lib/variations';

export function StudyStage({ animal }: { animal: Animal }) {
  const host = useRef<HTMLDivElement>(null);
  const motion = useMotionPolicy();
  const currentMotion = useRef(motion);
  currentMotion.current = motion;
  const [session, setSession] = useState<RendererSession | null>(null);
  const canVary = hasVariations(animal.id);
  const [selection, setSelection] = useState<VariationId | null>(canVary ? null : 'original');
  const selected = useRef(selection);
  const variation = selection ?? 'original';
  const chosen = availableVariations[variation];
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [compact, setCompact] = useState(false);
  const [notice, setNotice] = useState('');
  const [reactionNotice, setReactionNotice] = useState('');
  const descriptionId = `description-${animal.id}`;

  useLayoutEffect(() => {
    if (!canVary) return;
    const sync = () => {
      selected.current = readVariation(animal.id, window.location.search);
      setSelection(selected.current);
      setReactionNotice('');
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [animal.id, canVary]);

  function chooseVariation(next: VariationId) {
    if (selected.current === next) return;
    // Keep the static route mounted and make the variant link shareable.
    window.history.pushState(null, '', variationHref(window.location, next));
    selected.current = next;
    setSelection(next);
    setReactionNotice('');
    setNotice(`${availableVariations[next].name} selected.`);
  }

  // Release the renderer during the commit, before React detaches its canvas.
  // Passive cleanup can let a queued frame paint a detached route on a slow client.
  useLayoutEffect(() => {
    const element = host.current;
    if (!element || !motion.ready || selection === null) return;
    const cancellation = new AbortController();
    let active: RendererSession | null = null;
    setStatus('loading'); setSession(null);
    // Mount paused even if a chunk resolves after the user's motion preference
    // changes. Only the current policy may start it after ownership is acquired.
    mountRenderer(animal.id, element, {
      paused: true, reducedMotion: currentMotion.current.reduced,
      signal: cancellation.signal, label: variation === 'original' ? `${animal.name} ASCII study` : 'Octopus ASCII study: Pocket Trickster',
      descriptionId, configuration: movementControls.configuration,
    }, variation).then(renderer => {
      if (cancellation.signal.aborted) { renderer.dispose(); return; }
      active = renderer;
      renderer.setReducedMotion(currentMotion.current.reduced);
      if (currentMotion.current.paused) renderer.pause(); else renderer.play();
      setSession(renderer); setStatus('ready');
    }).catch(error => {
      if (cancellation.signal.aborted) return;
      console.error(`Could not open ${animal.id} study`, error);
      setStatus('error');
    });
    return () => { cancellation.abort(); active?.dispose(); };
  }, [animal.id, descriptionId, motion.ready, attempt, selection, variation]);

  useEffect(() => {
    if (!session) return;
    session.setReducedMotion(motion.reduced);
    if (motion.paused) session.pause(); else session.play();
  }, [session, motion.paused, motion.reduced]);

  useEffect(() => {
    const element = host.current;
    if (!element || !['gecko', 'owl'].includes(animal.id)) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCompact(animal.id === 'gecko' ? width < 360 : width < 350 || height < 330);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [animal.id]);

  function togglePlayback() {
    if (motion.reduced) return;
    motion.setUserPaused(!motion.paused);
    setNotice(motion.paused ? 'Animation resumed.' : 'Animation paused.');
  }

  function stageKey(event: KeyboardEvent<HTMLDivElement>) {
    // Only the focused artwork surface owns this shortcut. No page-level keys
    // are captured; forms, links, touch scrolling and extension controls keep
    // their normal semantics. This also avoids conflicting native Space toggles.
    if ((event.code !== 'Space' && event.key !== ' ') || event.target !== session?.element) return;
    event.preventDefault(); event.stopPropagation();
    if (!event.repeat && status === 'ready') togglePlayback();
  }

  function reactWithTrickster(action: 'invite' | 'pulse') {
    if (session?.variation !== 'pocket-trickster' || motion.paused) return;
    if (session.controller[action]()) {
      setReactionNotice(action === 'invite' ? 'Invitation sent.' : 'Ink pulse sent.');
    } else {
      setReactionNotice('Bring the artwork into view, then try again.');
    }
  }

  const stateText = status === 'loading' ? 'Opening study…' : status === 'error' ? 'Study unavailable'
    : motion.systemReduced ? 'Reduced motion · still study'
    : motion.stillMode ? 'Still mode' : compact ? 'Still view · compact layout'
    : motion.paused ? 'Paused' : 'Animation on';
  const Panel = movementControls.Panel;

  return <div className="study-workspace">
    <div className="stage-panel">
      <div className="stage-topline"><span className="eyebrow">Character study</span><span className="stage-state" role="status"><span className={motion.paused ? 'state-dot quiet-dot' : 'state-dot'} aria-hidden="true" />{stateText}</span></div>
      {canVary && selection !== null && <div className="variation-picker" role="group" aria-label="Variation">
        <span className="variation-picker-label" aria-hidden="true">Variation</span>
        <div className="variation-options">
          {(['original', 'pocket-trickster'] as const).map(option =>
            <button key={option} type="button" aria-pressed={selection === option} onClick={() => chooseVariation(option)}>
              {availableVariations[option].name}
            </button>)}
        </div>
      </div>}
      <div className="stage-frame" onKeyDownCapture={stageKey}>
        <div ref={host} className="renderer-host" data-testid="renderer-host" data-species={animal.id} data-variation={variation} data-status={status} data-paused={motion.paused} aria-busy={status === 'loading'} />
        {status === 'loading' && <div className="stage-message"><span className="loading-mark" aria-hidden="true">{'{a}'}</span><p>Opening {animal.name.toLowerCase()}…</p></div>}
        {status === 'error' && <div className="stage-message error-message" role="alert"><h2>The study could not open.</h2><p>Try again, or explore its original studio.</p><button className="button primary" onClick={() => setAttempt(value => value + 1)}>Retry study</button>{variation !== 'original' && <button className="button quiet" onClick={() => chooseVariation('original')}>Use Original</button>}<a className="text-link" href={originalPath(animal)}>Open original studio</a></div>}
      </div>
      {session?.variation === 'pocket-trickster' && selection === 'pocket-trickster' && <section className="trickster-controls" aria-labelledby="trickster-title">
        <h2 id="trickster-title">Invite it closer</h2>
        <p>Point or tap the water to beckon it. Tap the octopus for an ink puff.</p>
        <div className="playback-buttons">
          <button className="button quiet" disabled={motion.paused} onClick={() => reactWithTrickster('invite')}>Offer a hand</button>
          <button className="button quiet" disabled={motion.paused} onClick={() => reactWithTrickster('pulse')}>Ink and peek</button>
        </div>
        <p className="reaction-notice" role="status">{reactionNotice}</p>
      </section>}
      <div className="stage-caption"><p id={descriptionId}>{chosen.description ?? animal.description}</p><span>ASCII / {animal.habitat}</span></div>
      <noscript><p className="no-script">Animation needs JavaScript. <a href={originalPath(animal)}>Open the original {animal.name} studio</a>, or use the catalogue and species links to keep exploring.</p></noscript>
    </div>
    <aside className="study-controls" aria-label="Study controls">
      <section className="control-section" aria-labelledby="playback-title"><p className="eyebrow">At your pace</p><h2 id="playback-title">Watch. Pause. Wonder.</h2><p>Stay with the motion, or pause to see the characters.</p>
        <div className="playback-buttons"><button className="button primary" onClick={togglePlayback} disabled={status !== 'ready' || motion.reduced} aria-describedby={motion.reduced ? 'motion-explanation' : undefined}>{motion.paused ? <><span aria-hidden="true">▶</span> Play animation</> : <><span aria-hidden="true">Ⅱ</span> Pause animation</>}</button>
          <button className="button quiet" disabled={status !== 'ready'} onClick={() => { session?.restart(); setNotice('Study restarted. Playback preference kept.'); }}>Restart study</button></div>
        <label className="toggle-label"><input type="checkbox" checked={motion.stillMode} onChange={e => motion.setStillMode(e.target.checked)} /><span>Still mode<small>Keep every study still while browsing.</small></span></label>
        <p id="motion-explanation" className="motion-note">{motion.systemReduced ? 'Your system requests reduced motion. This study stays still.' : motion.stillMode ? 'Turn off Still mode to enable animation. Your pause preference is kept.' : motion.heldAfterReduction ? 'Your motion preference changed. Press Play when you are ready.' : 'Your system motion preference is respected.'}</p>
        {compact && <p className="motion-note">This animal uses a still view in a compact stage. A wider view allows animation.</p>}
        <p className="keyboard-hint">Focus the artwork and press <kbd>Space</kbd> to pause or play. <kbd>Tab</kbd> moves to the controls.</p>
        <p className="sr-only" role="status">{notice}</p>
      </section>
      {session?.variation === 'original' && selection === 'original' && isMarineSpecies(session.species) && Panel && <section className="control-section movement-controls" aria-label="Movement controls"><Panel key={animal.id} session={session} paused={motion.paused} reducedMotion={motion.reduced} requestPaused={motion.setUserPaused} /></section>}
      <section className="original-studio" aria-labelledby="original-title"><p className="eyebrow">More ways to explore</p><h2 id="original-title">Full studios</h2><p>Use the dedicated studio for more scenes, reactions, and individual controls.</p>{animal.fieldStudy && <a className="text-link" href={BASE_PATH + animal.fieldStudy.path}>{animal.fieldStudy.title} <span aria-hidden="true">↗</span></a>}<a className="text-link" href={originalPath(animal)}>Open original studio <span aria-hidden="true">↗</span></a><a className="api-link" href={apiPath(animal)}>Animal API <span aria-hidden="true">↗</span></a></section>
    </aside>
  </div>;
}
