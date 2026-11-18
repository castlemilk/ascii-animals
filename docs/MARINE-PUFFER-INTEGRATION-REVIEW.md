# Recovered marine and puffer director integration

Recovered against c7c385f7. Marine bundle head c9af682cbc9d2bc8ac0331f16e426cf0347b958b and SHA256 1eba36e4858d7d36e3a7ce7e4f4aaec53311ed37b53db9ee395d97cb109178b6 verified. Puffer full binary patch recreated exact tree 9afd0eee0fe741b1dfa4ab1cf7d80b09bc9341c3 before committing. No competing shared API rewrite; three Puffer private marine runtime copies regenerated from combined source.

## Independent review

- 354 repository tests pass after full build; root types, marine director types and Puffer director types pass.
- Local package validation passes with optional toolchains explicitly unrun. Not npm published.
- Real Chrome at local port8275: all three marine authored scenes selected, visibly different casts, invitation marker and octopus arm gathering observed. Pause persisted across scene changes; reduced-motion mobile starts STILL.
- Puffer real Chrome: reef/returning-tide/passing-shadow scenes and two/three-member casts observed; named roles and backdrop, autonomous movement and settling seen. Desktop pause/reset preserves pause.
- At390px reduced-motion, below-canvas Approach originally rejected because scrolling controls suspended the canvas. Fixed explicit offscreen actions to compose a still, retaining no RAF/offscreen draw. Hidden documents and zero-size canvases remain blocked. Regression covers pose, invitation, no elapsed ticks and no RAF. Hard reload confirmed actual below-canvas button now produces the inflated pose on returning to canvas.
- Console errors empty in checked tab. Temporary viewport/media/cache overrides restored.

## Honest remaining scope

This is bounded browser review, not exhaustive full-cycle capture, screen-reader audit, real-phone testing, frame-time benchmark, export/download acceptance or cross-browser validation. Native artifacts remain native evidence, not browser proof. Review branch only: no merge, Pages deploy or npm publication.
