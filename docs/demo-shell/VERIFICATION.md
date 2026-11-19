# Unified demo verification

19 November 2026. Integrated against `59bd5bebb0af`, after the 13-species
uplift. Next.js 16.4.6 static export (Webpack); Node 26.7.0. No changes to
species renderers, generated legacy studios, root exports or root lockfile.

| Check | Evidence |
| --- | --- |
| Production static export and consumer TypeScript | Real built package; 13 refreshable species routes, 135 byte-identical legacy assets, 782 checked local links, 117 fragments, 144 module references |
| Lazy-load contract | 11 package entry chunks; no renderer in initial/preloaded scripts across the catalogue and 13 study pages |
| Node consumer checks | 26 passed; real factories with simulated DOM/RAF resource bookkeeping |
| Playwright in Google Chrome 158 | 30 passed; all species load and refresh, unknown URLs return 404, legacy URLs/queries and marine variants are reachable, keyboard and phone-sized navigation, cancellation/disposal, reduced motion, and no-JavaScript navigation |

Browser runs use local static output under the same project URL prefix. Tests
use desktop Chrome and touch/phone emulation, not physical mobile devices. No
Safari, Firefox, assistive-technology certification or long-session performance
claim. The demo does not claim to migrate all original studios' controls.

The manual Pages workflow now assembles `demo/out` after the existing project
checks and validates the consumer. No Pages deployment or npm publication was
started by this integration.
