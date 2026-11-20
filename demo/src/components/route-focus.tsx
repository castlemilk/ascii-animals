'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Focus only after a route transition, not on initial entry or form changes. */
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    // The destination DOM is committed when this effect runs. No perpetual
    // timer or animation frame is needed for focus management.
    let fragment: HTMLElement | null = null;
    try { fragment = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); }
    catch { /* A malformed external fragment falls back to the page heading. */ }
    const target = fragment ?? document.querySelector<HTMLElement>('main h1');
    if (target && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
