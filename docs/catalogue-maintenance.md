# ASCII Animals catalogue

The root page is the collection, not a species. The hosted Cuttlefish study is `dist/cuttlefish-demo.html`; its self-contained offline build remains `dist/cuttlefish.html`. Existing renderer, recorder and standalone paths remain intact. The standalone builder now reads the hosted study, not the catalogue.

## Release honesty

Only Cuttlefish is available on the baseline reviewed for this change (main 0e446c4). Manta ray, octopus and ten commissioned animals are development entries, not implemented exports. Their card copy describes intended direction. No completion date is promised.

When integrating another animal, verify its visual, interaction, reduced-motion and lifecycle checks, add its real demo link, update its status and update the README table, hero counts and catalogue tests together. A Pro-chat completion report is not release evidence. The catalogue does not import unreviewed species code.

## Verification

Run `python3 scripts/check-catalogue.py`, `node --check dist/catalogue.js`, `node scripts/check-engine.cjs`, and `python3 scripts/build-standalone.py`. Serve `dist` and check the catalogue with and without JavaScript, keyboard focus, mobile width, search/filter combinations, empty results, reset, and navigation to/from the study. Deployment remains manual via the existing Pages workflow after reviewed integration.
