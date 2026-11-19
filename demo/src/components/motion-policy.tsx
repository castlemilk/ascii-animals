'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface MotionPolicy {
  ready: boolean;
  systemReduced: boolean;
  stillMode: boolean;
  userPaused: boolean;
  heldAfterReduction: boolean;
  reduced: boolean;
  paused: boolean;
  setStillMode(value: boolean): void;
  setUserPaused(value: boolean): void;
}

const MotionContext = createContext<MotionPolicy | null>(null);

/** Remains mounted across routes so a user pause is not lost during browsing. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [systemReduced, setSystemReduced] = useState(true);
  const [stillMode, setStillMode] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [heldAfterReduction, setHeldAfterReduction] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setSystemReduced(media.matches);
      // Returning from a reduced-motion preference is not a request to play.
      // Keep this hold separate from the user's own pause and Still mode.
      if (media.matches) setHeldAfterReduction(true);
    };
    sync(); setReady(true);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const value = useMemo(() => {
    const reduced = !ready || systemReduced || stillMode;
    return {
      ready, systemReduced, stillMode, userPaused, heldAfterReduction, reduced,
      paused: reduced || userPaused || heldAfterReduction, setStillMode,
      setUserPaused(value: boolean) { setUserPaused(value); if (!value) setHeldAfterReduction(false); },
    };
  }, [ready, systemReduced, stillMode, userPaused, heldAfterReduction]);
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionPolicy(): MotionPolicy {
  const value = useContext(MotionContext);
  if (!value) throw new Error('Study controls require MotionProvider.');
  return value;
}
