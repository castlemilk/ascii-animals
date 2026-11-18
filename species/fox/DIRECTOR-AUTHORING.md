# Fox director: Dusk in the meadow

## Scope and custody — written before implementation

Ben requests a visible expressive/compositional uplift of the integrated Fox, in regular Chat. Base **c06114404900884814bef879a02f1a49a3e7d590** was cloned and rechecked against remote main before creating **feat/director-fox**. No open PRs were returned at inspection. The original Fox branch is not reused. Only Fox canonical source, generated Fox demo, Fox-specific public adapter/declaration bridges, tests and docs may change. Shared package/core/registry/catalogue and marine sources are outside scope. Publication requires downloadable artifacts in chat first, then at most an authorized draft-PR path; a failed/approval-blocked path stops.

Current skill main is **23e078642157a273e2b886222470bd247e5737b5**, reviewed parent **e721252075a30888198aafba0953a23fd07bd3c6**, SKILL.md blob **8ef04dec7f4031f7e69b1319e182a7d722b41fe4**. Skill, authoring template and linked anatomy, contract, accessibility, validation, quickstart, examples and dated baseline were read. The dated baseline is superseded by current source, not treated as today's API.

Actual canonical Fox source is `species/fox/src/`. `src/species/fox/` supplies declaration bridges; `src/public/fox.ts` supplies the merged public wrapper. `scripts/build-fox.mjs` generates `dist/fox/`. Read `docs/ANIMAL-APIS.md`, `docs/FOX-API.md`, source, demo, tests and build before editing. No repository/ancestor AGENTS instructions found. Existing worktree clean. Source hashes are recorded in the final validation manifest.

Live baseline inspected in the cloud browser: `https://castlemilk.github.io/ascii-animals/cuttlefish-demo.html` and `/fox/`. Cuttlefish school presets, diagonal formation, role disabling under formations, encounter control and actual composed glyph canvas were observed. Fox single-character controls and actual page were inspected. A targeted Cuttlefish canvas click was attempted but an ink sequence was not reliably captured; source inspection establishes its routing/choreography. UI FPS labels are not measurements. This conversation is available; no other-chat transcript was reconstructed.

## Gap / behavior / scene matrix

| Current gap | Implemented target | Scene |
|---|---|---|
| One centered fox, empty surroundings | Small stable cast, triangular/depth composition, grass, moon, scent/leaf landmarks | Dusk hunt |
| Uniform tail/breathing idle; fixed ears | Independent seeded listening/sniffing episodes, attentive head/ear poses and tail emotion | All scenes |
| Manual isolated pounce | Local rustle → listen → stalk/sniff → pounce → recovery/rest; companions answer later | Dusk hunt |
| No play or rest choreography | Play bow and answering hops along curved paths; extended tuck/rest and sentinel attention | Moonlit mischief / Den watch |
| Generic controls | Three authored scene cards, stable named cast, individual motives, tempo/curiosity/wind/spread, selected-fox cue | All scenes |

## Animal, anatomy, rights

Stylized red-fox-like character, not a biological simulation. Reuse this repository's original Fox geometry; no imported drawings, fonts, photographs or ray core. Three anchors remain pointed paired ears, long tapering muzzle, bushy pale-tipped tail. Four articulated leg chains remain present. Side left/right profiles only; no yaw or frontal promise. Head/ears, tail and folded rest are authored exaggerations.

| Part | Attachment | Motion and limit | Small-grid policy |
|---|---|---|---|
| Torso | Existing model root | Existing breathing; rest lowering and play-bow blend | Preserve canid outline |
| Head and ears | Existing neck/head pivot | Bounded head pitch and independent ear swivel | One visible eye/nose; no disconnected ear |
| Four legs | Existing shoulder/hip points | Existing gait/pounce; tucked rest blend | Retain all chains; far legs may overlap |
| Tail | Existing tail root | Curious lift, alert hold, play sweep and resting curl | Pale tip remains distinct |

Source provenance is inherited from original Fox authoring record. New director, composition and scene effects are original code. No new external assets are copied. The repository remains private/unpublished and UNLICENSED; owner controls licensing. System monospace stack remains ui-monospace/SFMono-Regular/Consolas/Liberation Mono/monospace. No font binary bundled. Native evidence records the installed font hash separately.

## Representation and composition

Reuse `poseFox` and `buildFoxGrid` for each animal, retaining per-pose 48 polygon/1,024 vertex bounds. A Fox-only scene compositor combines bounded grids and owns a bounded owner-ID buffer; it does not fabricate an oversized multi-animal FoxPose or change the shared renderer. Scene output is printable ASCII plus newline. Scene glyph accents (grass, stars, leaf, scent marks) are declared printable characters. Canvas background colour is decorative; no image or shader asset.

Default scene grid 160×64, narrow layout 112×64; individual pose rasterization uses the existing allowed grid range. Maximum composite 160×64 (10,240 cells), 3 actors, 144 polygons/3,072 vertices across actors, 48 environmental accents. Minimum supported scene viewport 360 CSS px; narrower widths remain scroll-free but detailed anatomy is not guaranteed. Portrait layout stacks depth lanes instead of making all actors tiny. Physical cell ratio remains 1:2. Font readiness, size and DPR redraw through the existing host. Export uses textContent, never HTML. Static camera with deliberate composition prevents continuous zoom/camera-motion discomfort.

## Behavior and deterministic contract

| Phase | Entry | Body/appendages | Exit |
|---|---|---|---|
| Arrival | Scene start/restart | Staggered short approach; ears scan | Authored scene time |
| Listen | Quiet pointer/local rustle | Hold position, aim muzzle and ears; alert tail | Timed attention |
| Investigate/play | Hunt/game beat or cue | Cautious guide/sniff or play bow/curved path | Authored cue/cooldown |
| Response | Deliberate targeted action or authored beat | Existing captured crouch/arc/forepaw landing | Existing response durations |
| Recover/rest | Response end or den beat | Independent settle and tail tuck; sentinel stays alert | Next arc or deliberate cue |

Director state is separate from the closed legacy FoxBehavior/FoxState unions. The existing no-director factory stays single-animal and numerically unchanged. The optional director exposes explicit typed options, state, events, cues and still tableaux on the Fox subpath. getState remains the primary FoxState. No generic species/renderer contract is introduced.

Seed default 17; integer 60 Hz ticks and ordered input sequence. Director tempo changes authored scene progress, never the integer tick contract. Actor IDs survive count changes; existing poses/configuration survive non-scene settings. Scene selection restarts its authored arc deliberately, with current seed/settings/pause preserved. Repeated cues while reacting are ignored, not queued indefinitely. Pointer movement means attention; tap/click and equivalent keyboard cue create a local rustle. Nearest/visible actor ownership and explicit selection avoid triggering every actor. A bounded companion delay produces social response. Leave/cancel clears ephemeral attention. Browser coalescing is at most pointer plus one action per next tick. Replay callbacks expose accepted normalized events; internal logging is bounded/omitted.

Same engine/version/options/seed/tick/event sequence yields equal state/cells independently of render grouping. No cross-font pixel guarantee or arbitrary state restore. Reset restores seed, tick, scene and transient state; retains options/pause. Existing catch-up cap is five ticks; dropped wall time remains explicit. Resume clears elapsed accumulator.

## Accessibility, lifecycle and budgets

Native scene buttons, selects, sliders and cast buttons have labels and visible focus. Canvas keyboard controls act only while the canvas is focused; arrow guidance and Enter cue have equivalent touch/native controls. Page scrolling remains available. Sparse status announcements are user-action driven; scene telemetry is not a live region. Deliberate listen/pounce/rest tableaux are distinct without advancing any tick. Reduced motion remains authoritative through pointer, cue, reset and configure. User pause is independent.

Reuse the integrated scheduler/lifecycle seam: one subscription per mounted scene, release only its subscription; no own timer per actor. Hidden, offscreen, zero-size, paused and reduced-motion causes compose. Callback failure/partial setup rolls back all owned resources. Disposal idempotent; stale callbacks inert. No DOM reads, time or randomness in director core. SSR imports must remain safe.

Backing limit stays 1280×768 logical pixels and DPR≤2. Event batches ≤16, cast≤3, transient browser queue≤2, per-frame fixed steps≤5. No unbounded trails, particle pools or record buffers. Desktop target (unmeasured until run): 900×600 DPR1/2, 5s warmup and 30s sample, p95 frame work≤8ms and p99≤16ms. Browser/native/mock evidence must be separated; no mobile or device-performance claim inferred from GIF cadence.

## Acceptance and handoff

Pre-implementation gates: legacy model/type/integration regressions; director deterministic replay/config validation/routing/count identity/choreography/geometry; mock scheduler and suspension tests; strict positive/negative consumer types; generated demo parity; actual native/browser rendered review and bounded correction. Full browser keyboard/touch/zoom/font/accessibility and real-device timing are unrun until evidenced. Final review/validation docs will record exact commands, hashes, runtime, capture inputs, fixes and remaining gates.

Deliver a source ZIP, git binary patch, PR body and exact base/head/tree/validation manifest into this chat **before publication**. Only then attempt the authorized draft PR, stopping that path if approval is required or publication fails. Coordinator owns merge, deployment, package release and shared seams.
