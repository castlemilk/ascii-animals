# Pond and Wall director review

Recovered director base: `620ce8171a95941592626ec6f1a4a180d6e95b55`.

Independent actual Chrome review found a smallest-screen static composition defect:
after Change still pose, Reed and Ember merged at 390 CSS pixels. Initial lower
visitors now use separate reed territories; the first two arrival positions are
unchanged. A new 72×44 grid regression covers 3/4 visitors, both views, initial
and both static poses, requiring separate silhouette bounds and at least 95%
individual glyph retention. This checks default composition, not every possible
user-controlled scale/spread combination.

Actual Chrome revalidation of four visitors at 390×844 with reduced motion and
the alternate pose showed four distinct silhouettes. Pond desktop scene/role,
perch/dart controls and pause/reset/scene preservation were exercised. Reduced
motion selected still poses with flight-only actions disabled. Gecko desktop
moth/shadow encounters, curled-tail reaction, route control and paused reset/scene
changes were exercised; its deliberate selected-only mobile portrait was visible
at 390 pixels. Gecko reduced-motion shadow remained a still scene. Error logs were
empty during the bounded pre-fix interaction checks. The final log/override cleanup
call was interrupted by a disconnected computer; on reconnection all owned review
tabs were absent, confirmed through the browser inventory.

Both pages now preserve literal spaces when responsive CSS hides line breaks.

Reconnection validation: `npm test` 390/390 passing; `npm run typecheck` passing;
`npm run check:package` passed with explicitly unrun optional bundler/browser
checks; `git diff --check` passing. No performance, complete gait-cycle, physical
touch-device or screen-reader certification is implied. The library remains
private/unpublished. Merge/deployment require coordinator approval.
