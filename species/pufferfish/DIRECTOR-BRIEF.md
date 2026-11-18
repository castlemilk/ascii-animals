# Pufferfish director — authoring brief before implementation

## Scope and observed baseline

- Branch: `feat/director-pufferfish` from exact current main `c7c385f7cf58d9169ab1eb4f5f8dd3500fe31a02` (PR21 documentation reconciliation). Release `c06114404900884814bef879a02f1a49a3e7d590` is its ancestor; the intervening change touches only the shared README. No old branch is replayed.
- Authoring skill and linked references/template: `skunkworq/skunkworq-skills` at `23e078642157a273e2b886222470bd247e5737b5`, reviewed parent `e721252075a30888198aafba0953a23fd07bd3c6`. This brief completes the linked authoring template before director source changes.
- Read actual `docs/ANIMAL-APIS.md`, integrated factory, authoritative `species/pufferfish/src`, declarations, generated demo, scheduler, canonical marine rendering methods and applicable tests. No repository/ancestor AGENTS instructions were present. No open PRs at the initial read-only check.
- Direct live inspection: Cuttlefish scene presets, a 5-animal diagonal formation, solo close encounter, cursor follow and startle controls; Pufferfish approach/reset and its one centered inflation loop. This is baseline browser observation, not director acceptance or measured performance.
- Own only Pufferfish source/demo/tests/docs/generated output. Keep the canonical marine source, shared scheduler, package, registry, catalogue and other species unchanged. The current private painter dependency remains private. Export artifacts before any publication attempt.

## Gap / behavior / scene matrix

| Observed gap | Authored behavior | Scene and meaningful input |
| --- | --- | --- |
| One centered fish, no purposeful exploration | One to three distinct visitors inspect separate reef stations, gather, then settle; explorer, sentinel and drifter have different routes and attention | **Reef ramble**; select a visible individual, invite it toward a calm pointer/tap target, observe eyes and fins attend |
| Idle differs only by a small fin loop | A tide rises, visitors paddle against it, seek shelter, then emerge into slack water | **The returning tide**; signed current, tempo, spacing, size, role and population controls alter choreography |
| One repeated inflation response | Watchfulness, a passing shadow, local staged defense, group de-escalation and confidence return | **A passing shadow**; approach the selected fish, let proximity build, or give the group space to recover |

## Anatomy, silhouette and representation

- Three anchors: small rounded belly with a short tail; two raised readable eyes and small mouth; paired broad fins before inflation, then short radial spines around the expanded body.
- Preserve original parametric ellipsoid/eyes/fins/tail/spines; no copied ASCII drawing, ray core or renderer. Add bounded pupil attention, fin effort and original sparse reef geometry only.
- ASCII is the primary representation, using the canonical glyph atlas and cell/depth/owner buffers. Optional points use the canonical mode; they do not spawn particles. Text export uses the actual logical glyph grid.
- Existing glyph ramp and system monospace fallback; no font file is bundled or downloaded. Font ownership/licensing is unchanged. Glyph metrics remain rectangular (1:1.35), DPR at most 2. Preserve atlas sprite versus draw size.
- Small-grid limit: 72 columns remains available but fine detail is intentionally limited; the demo defaults to 160 columns for a readable ensemble. Under 360×270 CSS pixels, deliberate still alternatives remain available. At narrow widths composition/scale must keep all selected actors within the frame; native/browser evidence will decide any layout correction.

## Behavior and deterministic timing

- Existing solo behavior, defaults and `pufferfish-v1` pure model are unchanged when `director` is omitted. Director is additive and opt-in through the current factory.
- A scene has one deterministic clock and 1–3 dense stable actor IDs. Roles are explorer/sentinel/drifter. Each actor owns the existing immutable inflation state with a seed derived from the configured base seed and ID.
- Idle: varied bounded exploration, pauses to inspect, gaze and fin effort. Calm pointer/tap invitations attract the selected individual. Close sustained proximity triggers the existing dwell, belly inflation, spine extension, hold, recovery and cooldown.
- Explicit retreat wins any same-tick cue, clears invitations/targets and suppresses automatic threat cues for 240 ticks. A passing shadow may start one local reaction per scene cycle. No pulse/effect queue grows with clicks.
- Scene arcs loop over 1200 scene ticks. `tempo` scales choreography only; inflation/recovery safety durations remain 60 Hz model ticks. Routes approach targets with bounded velocity rather than teleport at phase joins. Individual motives and scene beat are exposed in snapshots and the demo.
- Normalized director input uses x/y in [-1,1], CSS aspect in [0.1,10], explicit integer tick exactly previous+1 and strictly increasing event sequence. Pointer proximity uses current actor placement/scale. Pixel ownership selects actual visible actors on click; empty-water taps invite the selected individual. No hover is required.
- Reproduction seed 23; capture scenes at ticks 1, 240, 420, 660, 900, 1199. Input replay: tick 121 select actor 1 when present; 122 invite target (0.35,-0.2); 361 approach selected; 461 retreat; 721 pointer near current selected actor; 841 retreat. Rendering frequency cannot change state.

## API, lifecycle and accessibility

- Explicit readonly options/config/input/event/state/actor/beat/result types. Unknown keys, invalid enums, non-finite/out-of-bounds values and invalid event ordering reject atomically. Runtime numeric validation complements positive/negative type tests.
- `configureDirector` starts a fresh deterministic scene and clears transient inputs, preserving pause. Population changes reset identities to 0…count−1 and derive deterministic seeds. `configureRender` preserves simulation. `configure`/`update` and reset retain the active director configuration. Old factory aliases remain intact.
- One controller subscription to the existing borrowed shared scheduler; no new RAF or scheduler ownership. Pause, hidden/offscreen, zero-size, compact, font readiness and disposal keep their current guarantees. Catch-up remains at most five ticks; stale callbacks cannot restart disposed work.
- Reduced motion and paused/compact states render deliberate still compositions. Select/invite/approach/retreat can show an explanatory still without advancing time or starting a clock. Hidden/zero-size actions are suspended. Resume clears stale proximity.
- Native buttons/selects/ranges and focusable canvas. Keyboard actor selection, invitation, approach, retreat, pause/reset with an on-screen key guide; keyboard handlers scoped to the canvas and do not hijack form inputs. Touch tap/select/empty-water invite; no mandatory drag or hover. Labels and a polite text status explain roles/scene beat without per-frame announcements.

## Budgets and evidence gates

- Max 3 actors, max 16 explicit events per tick, at most two coalesced controller pending inputs, no effects allocation queue. Whole rendered scene ≤16,000 procedural samples, ≤160×90 cells, ≤1200×675 logical pixels and DPR≤2. Use explicit ensemble geometry LOD and report combined sample count; limits are budgets, not a performance certification.
- Tests: original solo replay, geometry/attachment bounds, director determinism and phase joins, per-actor targeting/cooldown, retreat priority, atomic validation, scene capacity, typed consumers, SSR import, lifecycle/scheduler ownership/reentrancy, generated-demo parity and applicable repository regressions.
- Capture actual canonical native-Canvas frames/contact sheet/animation; review anatomy, readable staging, composition and motion, fix at least one evidence-led issue in a bounded loop. Browser UI observation is distinct from native pixels and stub lifecycle tests. No deployed-director claim until coordinator integration/deployment.
- Acceptance manifest will list exact commands/results, source/base/head/tree hashes, provenance, artifacts, limitations and unrun browser/performance/platform gates. No GitHub write before downloadable ZIP/patch/PR body/manifest are saved and linked in chat. Publication approval/failure ends that path without retry.
