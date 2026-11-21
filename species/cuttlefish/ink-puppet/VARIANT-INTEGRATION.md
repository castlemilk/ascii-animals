# Ink Puppet in the field guide

This is an optional character variation, not a new canonical cuttlefish
renderer. The Original gallery and classic studio must remain unchanged,
including 35%/140% lens contact and Independent swimming. No public npm export
is needed.

- Suggested URL: `/ascii-animals/animals/cuttlefish/?variation=ink-puppet`.
  Register this token only for Cuttlefish; unknown or duplicate tokens use
  Original without rewriting the URL.
- Lazy-load `demo/src/lib/ink-puppet.mjs` from the selected renderer mount.
  `createInkPuppetVariant(canvas)` returns `{ controller, playback }`, paused
  from construction. Check cancellation after import and before creating the
  single stage-owned canvas. Pass playback into the existing `ownLifecycle`
  (and native controller into its discriminated session). Destroy on abort,
  route/variant change, or mount failure. Avoid importing the standalone page.
- Render `InkPuppetControls({controller, paused})` only for a ready Ink Puppet
  session. The component's separate action module has no native renderer import,
  so it cannot make the renderer eager. Use the existing panel and shared
  Original/variation picker, not a second playback UI. Keep Original-only
  movement controls on their existing path.
- Two keyboard/touch-accessible buttons immediately act on a known aim point.
  Each also selects the tool for the next tap on the canvas. While paused or
  reduced-motion, either deliberate button makes a still frame, not playback.
  Space, pause, restart, reduced motion, and errors stay managed by the shell.
- Add the adapter as a lazy-only entry in the static export audit, including
  verifying it isn't in preloaded / initial scripts. Keep original URL query
  and hash handling, Back/Forward, DOM ownership and teardown coherent.
- No new dependencies. Standalone captures and concept boards are review
  references, not embedded runtime pixels. Prototype source was imported
  unchanged. Remaining gate: actual browser verification of the assembled
  picker, native canvas input, narrow layout, history/abort and one surface.
