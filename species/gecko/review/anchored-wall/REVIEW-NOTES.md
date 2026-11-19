# Gecko — final source and visual review

**19 November 2026 · Base:** `b8f222dab868821f27bf2a64a98434f3483fc8e6`

**Conclusion:** No additional implementation blocker identified in the reviewed
diff. Real-browser acceptance remains open. This reviewer supplied reference
research and demo controls, then separately reviewed the final locomotion,
renderer, host and test changes; this is not an independent certification of
the entire product.

## Scope, contract and lifecycle

- The inspected working diff stays under `species/gecko/`, including its own
  compiled files, tests, capture scripts and review evidence. No shared engine,
  other species, public facade, workflow or repository setting was changed.
- Existing public factory/controller signatures and action-result unions remain.
  `GeckoFoot.toeSpread` is optional and additive; it latches pad geometry to a
  contact. The new locomotor drive is species-internal and is not re-exported by
  `src/public/gecko.ts`. New UI nodes are optional for the original demo fixture.
- Planted palm position, fan angle and spread feed toe geometry directly. The
  authored thrust uses bounded root displacement with reach/side constraints;
  a catch is awarded from actual jaw proximity. Recovery replants contacts
  sequentially. Source contains no new ambient random source or wall clock.
- Added keys remain canvas-local and call existing controller operations. No
  scheduler or listener-ownership path was replaced. Pause, reduced motion,
  hidden/offscreen/zero-size suspension and disposal still use the existing host
  gates. This is source inspection, not a real-browser lifecycle pass.
- Updated legacy fixture hashes are explicitly described as changed gait/art
  output. They must not be presented as old pixel/state parity. New tests inspect
  contact invariants, real thrust, jaw contact, interrupted/repeated cues, replay,
  and mocked-host suspension rather than accepting a changed label alone.

## Visual review and remaining follow-up

Viewed the earlier matched desktop/phone native composites and the final quick
390 px native views supplied as `final-moonlit-wall.png` and
`final-lantern-hunt.png`. The broad head/narrow neck, four bent limbs, separated
pad fans and attached tapered tail read as a gecko. The selected phone view has
useful scale. Final changes add nearby plaster landmarks and an exposed mouth
gap/lip, addressing the earlier faint-wall and hidden-jaw findings. The wall
remains deliberately subdued. Not every pad is individually countable in the
full-cast desktop still; the close view is the more useful anatomy inspection.

**Remaining concrete documentation mismatch:** `docs/GECKO-API.md` still lists
the automatic full-wall grid as **224×144**; final host/renderer use **224×112**.
Bear should reconcile that table during central integration. This review does
not edit the shared documentation or generated package entry points.

**Unfulfilled evidence gate:** Native Canvas images show character rendering,
not the page's responsive HTML/CSS controls. The action strip specifies 44 px
minimum targets, but real 320/390 px layout, touch, focus and keyboard interaction
remain unverified. The recorded browser attempt is blocked and contains no
captures. No further browser attempt was made here. Still images alone do not
prove continuous no-slip movement, frame rate, or device performance.

## Reference provenance and verification boundary

Public references: [Smithsonian description](https://www.nationalzoo.si.edu/animals/tokay-gecko)
and [public-domain photograph](https://nationalzoo.si.edu/object/nzp_NZP-2559-4JC)
for anatomy/material; [Annual Reviews, Video 3 description](https://www.annualreviews.org/content/journals/10.1146/annurev-ecolsys-120213-091839)
for toe hyperextension; [Tokay prey research](https://pmc.ncbi.nlm.nih.gov/articles/PMC7616155/)
for hunting/post-capture stillness; [house-gecko tail experiments](https://pmc.ncbi.nlm.nih.gov/articles/PMC2393739/)
for broader tail context. The photograph was viewed; the toe video was not
played. The tail study concerns a different gecko species. Gait order, timing,
three-resident composition and supported pounce are artist-authored, not a
measured biological reconstruction. No reference media is bundled.

This review ran `git diff --check` successfully and inspected source, tests,
the two quick renders and the existing blocked-browser record. It did **not**
compile, run the test suites, play the final videos, or validate final capture
hashes. Exact execution results belong to the accompanying review manifest.
