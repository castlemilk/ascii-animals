# Butterfly director — authoring and review record

## Scope and source custody

- Repository: https://github.com/castlemilk/ascii-animals
- New isolated branch: `feat/director-butterfly`.
- Initial current-main check: `c06114404900884814bef879a02f1a49a3e7d590`.
- Integration base after the next main check: `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02`. Its only intervening change was README reconciliation; the branch was fast-forwarded before substantive integration.
- Inspected actual integrated source: `src/public/butterfly.ts`, `species/butterfly/demo/*`, `dist/butterfly/*`, `test/butterfly.test.mjs`, `scripts/build-butterfly.mjs`, `docs/ANIMAL-APIS.md`, `docs/BUTTERFLY-API.md`, package/build configuration and scheduler.
- There is no integrated `src/species/butterfly` at this base. New pure director/render helpers live inside the existing TypeScript root at `src/public/butterfly/`.
- Live references inspected visually and through their controls: https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html and https://castlemilk.github.io/ascii-animals/butterfly/ . Live deployment identity is observed separately from repository identity.
- Authoring workflow: actual `generate-reactive-ascii-animals/SKILL.md`, retrieved from the connected skill repository; blob `8ef04dec7f4031f7e69b1319e182a7d722b41fe4`, with authoring, anatomy/glyph, portable-contract, accessibility/budget and validation references read.
- No unavailable old conversation or old species branch was recovered or reused. This is an improvement to current integrated main.
- Authority: butterfly source/demo/tests/docs and draft PR only. No shared core, catalogue, registry, package, marine source, other animal, deployment or release changes.

## Gap / behavior / scene matrix before implementation

| Observed baseline gap | Chosen butterfly behavior | Scene/composition |
| --- | --- | --- |
| One centered actor | Bounded meadow of 1–6, persistent IDs, individual roles/wing phases | First light, with airborne scout/wanderer and warming forager/basker |
| Small hover/approach loop | Flutter → inspect → nectar → glide → return | Nectar rounds across individual flower targets |
| Small cursor offset | Local attraction or breeze, deliberate cues, cancellation and recovery | Passing breeze: lift, ride, shelter, return |
| No authored ensemble arc | Distinct act targets and a final folded pose | Evening roost: forage, ascent, choose stem, rest |
| Sparse controls | Readable act timeline, scene cards, role ledger and composition settings | One coherent garden director with scoped keyboard and still states |

The cuttlefish reference demonstrated population/formation controls, explicit individual roles, scene descriptions, and arrival/linger/depart direction. The implementation translates that expressive structure into flower visits, warming wings, glides, shelter and roosting. It does not reuse marine school/flee/ink behavior.

## Anatomy, representation and provenance

This is a stylized butterfly, not a named biological species. Recognition anchors are four distinct patterned lobes, a slender segmented body, and paired clubbed antennae. Existing original lobe geometry is adapted into inverse cell rasterization. The body owns legs and antennae; headings rotate the complete anatomy rather than detaching appendages. Feeding may turn the head toward a bloom; roost folds the wings.

| Part | Attachment and motion | Small-grid policy |
| --- | --- | --- |
| Fore/hindwing pair on each side | Thorax; shared opening with small seeded side lag | Distinct waist/notch and ~13-column open-wing LOD floor |
| Head/body | Central axis; rotates with actor | Stable `@`, `#`, `|`, segmented `=` glyphs |
| Antennae | Two head attachments with club tips | Fine line segments merge at low density; tips stay attached |
| Legs | Six thorax attachments | Fine segments merge intentionally |
| Proboscis | Head to assigned bloom during nectar | Fine dotted connection behind body |

All new geometry, flowers, paths and UI are code authored for this change. No photography, model geometry, external drawing, online ASCII art, font binary or generated-image asset is copied. Existing repository source retains its existing custody/license status; no new project license is asserted. The font stack uses installed system monospace fonts. The native evidence renderer uses installed font fallback; its pixels are not a guarantee for another system.

## Lifecycle, interactions and reproducibility

The [API guide](BUTTERFLY-API.md) specifies exact options, role/cue precedence, tick bounds, scene clock, static actions, resource caps, reset and cleanup semantics. Both new helpers are browser-free. Integer stepping is partition-invariant, and animation-clock continuity is separate from manual scene-act changes. The browser adapter keeps borrowed scheduler ownership and composes independent pause causes.

The shared root barrel explicitly exports only the four existing butterfly runtime values, while its declarations re-export types. Rather than introducing unmatched new root constants or editing that shared barrel, scene metadata is a typed `getScenes()` method. **Optional shared proposal, not implemented:** a future coordinator could export scene descriptor constants uniformly across species after reviewing both runtime and declarations.

## Executed review and corrections

An independent code reviewer found and reproduced three bugs in the first implementation:

1. Normal touch capture release could cancel the cue started by the tap. Normal touch completion now releases attention but preserves the cue; cancellation remains explicit.
2. Appearance-only updates while paused could snap actor positions. Appearance edits now preserve the held arrangement; choreography edits may select a new still pose.
3. Repeated still invitations kept their first anchor. Same-kind poster cues now reanchor without ticking or subscribing.

All three have regression tests. Review also removed misleading flower IDs from invitation inspection and expanded palette treatment to the whole garden.

The first actual native render was bottom-heavy. First light was revised to start with scout/wanderer airborne and forager/basker warming. The renderer gained a sparse-grid silhouette floor and conservative edge fitting. Individual desktop wings, feeding orientation and folded roost poses were visually inspected. A bounded separation adjustment preserves free paths rather than enforcing rigid formation. Overlap can still happen during crossings and invitations; this is a garden composition, not collision-free packing.

The [native Canvas contact sheet](../species/butterfly/evidence/director/contact-sheet.png) records the final four scene compositions.

## Evidence categories and limits

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Existing and new Node tests | Legacy compatibility, validation, state/cell replay, scene/motive diversity, finite bounded output | Browser pixels or human visual recognition |
| Lifecycle harness tests | Scheduler/listener/observer bookkeeping; pause/reduced/hidden/offscreen causes; touch event sequence semantics | Real browser event timing, heap leaks or device touch usability |
| Strict TypeScript and package/SSR checks | Valid consumers, expected type rejection, import/build/packaging compatibility | A released package or framework certification |
| Native Canvas images and sampled animation | Real renderer output and scene composition under the declared host/font setup | Browser screenshots, CSS layout, mobile-device performance |
| Browser harness source | A runnable acceptance path for an environment with browser/socket access | A passed browser test in this environment |

Normal local Chromium failed to launch because `socket()` was denied by the environment. The cloud browser inspected the current live sites, but localhost preview navigation returned `ERR_CONNECTION_REFUSED`. No security settings, credentials, network policy, approval flow or browser flags were changed to work around these restrictions.

Remaining acceptance: execute `species/butterfly/tests/browser-check.mjs`; review actual desktop and 390px mobile reflow, keyboard focus/Tab and touch cancellation; verify screen-reader alternatives and contrast; observe normal-speed motion on a target phone; profile CPU/heap/frame work if a performance claim is required. The supplied small mobile native frame demonstrates the composition only; fine labels and patterns remain tiny at six visitors.

Exact base/head, changed-file hashes, final command results, and the artifact-first publication boundary are recorded in the external handoff manifest so the document does not contain a self-referential commit hash. No merge, deploy or npm publication is authorized by this record.
