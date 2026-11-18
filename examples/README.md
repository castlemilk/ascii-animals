# Candidate example

From the checkout root, run `npm run build` and then
`python3 -m http.server 8000`. Open
`http://localhost:8000/examples/cuttlefish.html`.

This small host imports the generated ESM library, provides labeled native
controls, starts paused, synchronizes a system-motion pause, and owns its own
abortable UI listeners. It has no polling timer or framework dependency. The
original `dist/` microsite is still the imported baseline; this example does not
replace its school director, recorder, source viewer, or standalone exporter.

The module passed syntax validation. This review did not run it in a real
browser. Visual, keyboard, screen-reader, touch, and lifecycle acceptance are
listed in `docs/RELEASE.md`.
