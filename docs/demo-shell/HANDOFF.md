# Next.js demo integration

The regular Pro Chat navigation candidate was applied to the 13-species
uplift at `59bd5bebb0af`. The [demo README](../../demo/README.md) has the
local build and review commands. The [verification record](VERIFICATION.md)
separates tests from live deployment.

- The Next app uses the built private package. New species need catalogue
  metadata, a public renderer adapter, and matching export/browser tests.
- The shell owns one active renderer. Put future configurable director controls
  behind `demo/src/extensions/movement-controls.tsx` and keep renderer disposal
  and playback policy with the shell. An adapter should expose only commands
  the species supports. Marine's director is a distinct public factory, not
  a method of the base `createArtwork` controller.
- The Pages artifact is `demo/out/`. Its root is the canonical catalogue;
  each species has one primary route. The full native studios, three authored
  marine variants, and downloads remain available at their existing URLs.
  The old files are preserved byte-for-byte except the catalogue index.
- Pages remains manual. Before dispatching, verify the chosen `main` commit,
  then verify the deployed root, a direct species route, and old URLs. Do not
  change the private package's publish policy to run the demo.
