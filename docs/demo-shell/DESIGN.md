# Demo shell: pinned visual and navigation design

**Pinned before UI implementation:** 19 November 2026, 10:17 AEDT (18 November 2026, 23:17 UTC).
**Source baseline:** `b8f222dab868821f27bf2a64a98434f3483fc8e6`.
**Scope:** Next.js catalogue, route shell, navigation and renderer host. No animal geometry, choreography, library exports or publishing changes.

[Open the pinned wireframe](wireframe.svg). This is a layout specification; it is not a screenshot or evidence of renderer output.

## Evidence used

- `dist/index.html`: thirteen animals in a stable order, a field-guide presentation, search and habitat filtering, public study links and a separate library section.
- `dist/catalogue.css`: dark forest backgrounds, pale lime accent, system fonts, visible keyboard focus and a single-column small-screen layout.
- `dist/catalogue.js`: name/habitat filtering, live result count, reset returning focus to search.
- `docs/ANIMAL-APIS.md`: twelve canvas species and an intentional DOM-text Owl host; independent species contracts; explicit disposal; private/unpublished package; marine built-ins share one renderer implementation.
- `package.json`: real built package exports and intentional publication guard. The shell must consume those exports rather than copy rendering code.

`docs/catalogue-maintenance.md` includes historical single-species release language. It is useful for URL responsibilities, but the current catalogue and API map establish the current count.

## Options considered

| Option | Visual direction | Strength | Cost / tradeoff |
| --- | --- | --- | --- |
| Living field guide | Forest black, warm white, lime, large editorial title, numbered cards | Continues the existing collection identity; clear catalogue and calm framing for colourful animals | Needs disciplined separation between editorial catalogue and functional study tools |
| Instrument studio | Neutral charcoal, cyan, compact chrome, dense side controls | Strong fit for direction and configuration; maximises stage space | Can make discovery feel like a technical dashboard; dense controls are less comfortable on phones |
| Paper notebook | Warm ivory, dark ink, fine rules, restrained green | Natural-history feel; excellent reading and catalogue hierarchy | Abrupt contrast around dark renderer backgrounds; larger departure from the existing visual identity |

## Pinned decision

Use **Living field guide**, with a restrained instrument panel only on a study page. Preserve the forest-black/pale-lime relationship, system fonts, large but concise headings, fine borders and generous stage space. Avoid animated decoration, fabricated animal thumbnails and card-sized live renderers. The catalogue is a fast, static index; the selected study owns one active renderer.

### Tokens and proportions

| Token | Pinned value / intent |
| --- | --- |
| Page background | `#101713` |
| Elevated panel | `#17221b` |
| Stage | `#080d0f` |
| Primary text | `#edf3e8` |
| Secondary text | `#adbbaf` |
| Border | `#35483b` |
| Accent and focus | `#d9eea0` |
| Body | System UI sans-serif; minimum 16 px for reading and form inputs |
| Labels and numbering | System monospace; use sparingly, never for long prose |
| Page width | Approximately 1440 px, fluid gutters of 20–48 px |
| Desktop study | Species navigation rail + flexible stage; controls beside or beneath the stage as room permits |
| Small screens | One column; native species selector; stage then controls then previous/next |
| Touch targets | At least 44 px high for controls and navigation |

Colours are design tokens, not a contrast certification. Browser validation must check text, controls and focus against the actual rendered backgrounds.

## Catalogue structure

1. Skip link, linked brand, Catalogue, API/source link.
2. Visible breadcrumb with the current catalogue identified using `aria-current="page"`.
3. “Small characters. Wild personalities.” and a concise description.
4. Labelled name search, labelled habitat selector, reset and polite result count.
5. Thirteen numbered cards in the existing order. Each card has a species heading, habitat, a short accurate description and one clear “Open study” link. No nested interactive cards.
6. Library/source links, including preserved standalone download where available.

Provide useful pre-rendered links and cards with JavaScript disabled. Search/filter controls can be progressively enabled. Empty results give a clear reset path. Preserve `#catalogue`, `#library`, `#title` and existing species anchors where practical.

## Study structure

Canonical routes are `/ascii-animals/animals/[slug]/`; the existing studio URLs remain available. The catalogue remains `/ascii-animals/`.

1. Shared header.
2. Visible breadcrumb: `ASCII Animals / Catalogue / Cuttlefish`, with only the final segment current. The linked brand can share the catalogue destination; do not invent an intermediate home page.
3. “Back to catalogue” link and a species heading with habitat and position, e.g. `01 / 13 · Ocean`.
4. Desktop species rail with the active species visibly marked and `aria-current="page"`; mobile labelled native selector. All thirteen destinations stay available without scrolling an overflowing horizontal tab strip.
5. A large stage host. The host supports canvas and semantic DOM text without forcing either into the other. The wireframe deliberately shows a labelled blank stage, not fabricated animal output.
6. Persistent play/pause, a separate Still mode choice and visible system-motion status outside the rendering surface. Loading, error and static states stay readable and do not hide navigation. Interaction guidance must come from verified species capabilities.
7. A named movement-controls region is the integration point for the movement owner. Only supported controls are mounted; it must not advertise a universal choreography API. If no plug-in is installed, omit the empty controls and retain a plainly labelled link to the original full studio.
8. Previous / Next species links use the catalogue order. At the ends, omit the missing neighbour or render noninteractive explanatory text; never show a disabled-looking live link. “Back to catalogue” remains deterministic on direct entry; browser Back continues to work normally.
9. “Original studio” and API/source links remain available, clearly describing their destinations.

## Focus, motion and state

- Keep semantic landmarks and a single page `h1`. The skip link targets the main content.
- Give all links, buttons, inputs and selects a strong, offset focus ring that is not clipped by cards or overflow containers.
- On client route navigation, move focus to the new page heading/main region without scrolling unexpectedly. Restore a useful position when returning to the catalogue if the implementation can do so reliably; do not invent success evidence.
- Do not capture global arrow keys, Backspace or letter shortcuts in the shell. Inputs, assistive technology and species-specific controls retain their own semantics.
- Respect `prefers-reduced-motion` before mounting/starting the renderer. Play stays disabled while the system requests reduced motion. Keep the system preference and the separate user-selected Still mode independent: changing one must not clear the other. Paused/reduced-motion states must not depend on colour alone.
- Make the main navigation and stage controls usable at 320 px wide, at 200% zoom, and by keyboard. Avoid fixed-height mobile panels and sticky bottom bars that cover controls.
- Loading another route invalidates pending asynchronous renderer loads and disposes the previous controller. The visual design does not permit hidden background previews.
- A route-load failure presents an inline message, a retry action if supported and a working catalogue link. Existing rich study URLs remain separately available.

## Integration boundary

The movement owner receives a stable, typed demo-only plug-in slot, the active species identity, the verified controller or a species-specific adapter, and the current playback/reduced-motion state. A plug-in may contribute its own controls and cleanup, but cannot create a second renderer or assume every species exposes the same movement methods. The anatomy owner has no changes in this design.

The exact TypeScript signature belongs in the implementation handoff once the verified adapter contract is established. This document pins layout and ownership; it does not invent an API.

## Acceptance targets for implementation

- Catalogue, breadcrumbs, Back, Previous, Next and mobile selector work under `/ascii-animals`.
- Every species route can be opened directly and refreshed from a plain static server.
- Original hosted study URLs and their dependent assets remain available or are migrated by an explicitly tested mapping; standalone download semantics remain intact.
- Only the selected renderer is instantiated; route changes and stale asynchronous loads leave no active prior controller.
- Keyboard focus, reduced-motion first load, mobile overflow and no-JavaScript navigation receive explicit checks.
- Browser/CI limitations are recorded honestly. The wireframe alone proves none of these behaviours.

## Refinements after the pinned wireframe

The initial layout above was pinned before implementation. Independent review
then produced these concrete refinements without changing the visual direction:

- The mobile selector keeps a pending choice and an explicit **Open selected
  study** button. Arrow-key selection does not unexpectedly change the route.
- Without JavaScript, the mobile selector is hidden and ordinary species links
  are shown. Catalogue, breadcrumbs and previous/next remain real links.
- Returning to a catalogue/library fragment focuses that section; other client
  route changes focus the new page heading.
- An observed system reduced-motion preference adds a separate playback hold.
  Turning that preference off does not silently resume animation; explicit Play
  clears the hold. User pause and Still mode remain independent causes.
- Breadcrumb links and primary navigation targets are at least 44 CSS px high.

The SVG was rasterized with Sharp and visually inspected for layout and text
placement. That inspection covers the wireframe only. Neither available browser
path could inspect the implemented app; see `VERIFICATION.md` for the exact gaps.
