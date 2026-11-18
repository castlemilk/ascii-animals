# Dragonfly pond director — authoring brief

## Inspected base and scope (before implementation)

Base/main: `c06114404900884814bef879a02f1a49a3e7d590`; new isolated branch `feat/director-dragonfly`. No open PRs at the initial read. No AGENTS.md was present in the inspected repository/ancestor paths. The accepted `./dragonfly` adapter, source/declaration bridges, shared scheduler, build scripts, `docs/ANIMAL-APIS.md`, Dragonfly tests and generated Pages demo were read. The earlier species branch is not replayed.

The current animal skill and the previously read linked authoring template/references apply. Existing original anatomy, font rights and factual reference ledger remain in AUTHORING.md. This extension is original scene logic around that geometry; it does not copy the marine renderer or teaching ray.

Live Cuttlefish and Dragonfly were inspected through the cloud browser. Cuttlefish exposes scenes, 1–12 population, formation presets/paths, individual roles, current, palettes and capture; the observed horizontal procession coordinated multiple visitors. Dragonfly currently presents one hover/dart specimen. These are observations of the existing deployment, not evidence of the new implementation.

## Compact gap / behavior / scene matrix

| Gap | Authored behavior | Visible scene / control |
| --- | --- | --- |
| One specimen near center | 1–4 seeded individuals with separate home reeds, phase offsets and motives | Pond patrol; population, roles and labels |
| Pointer is the whole scene | Selected individual attends a normalized pointer/guide; others continue their routes | Hovering attention; individual selection |
| Dart establishes a new anchor | Launch → short intercept → stabilize → return → cooldown or landing | Dart & return; target guide |
| No still-life rhythm | Route → reed approach → landing → held perch → takeoff | Reed relay; Land on reed / Resume route |
| Little composition | Banks, figure-eight and orbit paths, spacing, size, tempo and breeze | Bounded pond director |

## Anatomy, representation and display

Retain the three silhouette anchors: paired large eyes, long ten-segment abdomen, four narrow attached independently phased wings. Reuse original geometry and glyph projection. Transform samples and wing/eye/abdomen landmarks together. Landing smoothly reduces wing motion; perched wings remain spread and attached. This is stylized aerial choreography, not a claim of biological flight simulation.

ASCII-only animal cells with the existing system-monospace fallback; no font or external assets added. Minimum 72×44 grid remains supported; default population three, maximum four. Native captures must review wing separation at minimum grid and default desktop size. Compose each existing bounded raster in stable individual-ID order, then paint once. Contextual reeds/water and individual labels must remain subordinate to the animals.

## Typed behavior and input contract

Opt-in `director` mount configuration; omitted configuration preserves the existing solo consumer. Existing model options, getState/getOptions, exact-tick replay and public aliases retain their contracts. New director snapshots/options are separate. The public Dragonfly subpath may re-export species-local types/factory through its existing export; no shared export-map, engine or registry changes.

Director options: scene patrol/attention/relay (patrol), population 1–4 (3), route banks/figure-eight/orbit (banks), tempo .4–1.6 (1), spread .65–1.1 (1), scale .28–.48 (.4), breeze −.5–.5 (.12), labels (true), four roles (patroller, sentinel, skimmer, wanderer). Reject unknown, undefined, nonfinite and out-of-range values atomically. Retained member IDs/seeds survive population changes; removed models are disposed.

Explicit 60 Hz next-integer director tick, seed 17 by default, stable per-ID derived seeds, maximum 16 ordered events/tick. Event vocabulary: select, pointer, leave, cue dart/perch/return. Selection precedes pointer/cue in the host's coalesced batch; direct API events apply in the supplied validated order. Pointer affects the selected individual. Active response ignores repeated dart/perch cues; return deliberately cancels toward the assigned route. Pause/static validates but consumes no tick/events. Configuration, reset and host suspension start a new replay segment.

Fixture: seed 17, patrol/3/banks; tick 90 select individual 1, tick 91 guide (.6,−.35), tick 140 dart, tick 420 leave, tick 480 perch, tick 720 return; capture through tick 960. Separate scene posters and relay phases use fixed seeds/ticks. No ambient randomness, wall clocks or DOM reads in the director.

## Phases and accessibility

Autonomous personality combines patrol, hover inspection, return, land, perched and launch phases. Manual dart includes launch/dart/settle/return/cooldown, and returns to a captured pre-cue anchor; a perched visitor returns to its reed. Perch deliberately holds until a release/dart cue. Scene changes redirect smoothly without resetting the clock. Individual flight geometry uses its existing model and an independent director root transform.

Keyboard/touch: semantic scene/route/role selectors, selected individual, Guide, Dart & return, Land on reed, Resume route, Pause/Reset, Slow/Still. Pointer never overrides pause/reduced motion. Deliberate still actions change a composed pose without advancing time or scheduling work. Reset preserves configuration and user pause. Hidden/offscreen/zero-size suspension drops elapsed wall time; disposal removes only this host's subscription and owned resources.

## Predeclared budgets and validation

One canvas/host/shared-scheduler subscription; 1–4 models; ≤4×6144 samples (original geometry currently 4348/member); ≤160×88 cells; DPR≤2; backing logical size≤1200×700; ≤5 simulation steps/callback; ≤3 coalesced host inputs; no unbounded trails/particles/history. Active scene velocity/acceleration are explicitly capped; camera bounds are checked for supported configurations. Native/Node timings are not a browser FPS claim.

Required evidence: unchanged solo regressions; deterministic scene/event sequence; strict positive/negative types; count/config/input validation; phase ordering and return/perch; named anatomy transforms; scene bounds and stable compositing; one borrowed subscription, pause/reset/reduced/hidden/zero/disposal; generated demo closure. Capture actual rendered scene/phase contact sheets and animation; perform one independent critique and fix the largest evidenced issue. Real-browser/mobile/assistive-tech/performance gates are reported separately. Artifact ZIP, binary patch, PR body, exact hashes and validation manifest precede any publication attempt.
