# Source and release status

This is an isolated review candidate based on `castlemilk/ascii-animals` draft
PR #1, branch `feat/cuttlefish-microsite-import`, exact commit
`7e5984d34a139b8de4643f1ed0607897a42d88dc`.

The imported renderer is `dist/artwork.js`, Git blob
`cecc7fc7f33ce5c6232d4c4bf8668b08dba7848b`. It was verified byte-for-byte against
the available local microsite source commit
`afcce9941c5fa13ca5c658564e73388e603dff14`. All 21 imported files match that local
snapshot. Private `.openai/hosting.json` metadata is excluded from the import
and this package.

The imported README describes the JavaScript procedural artwork as an original
implementation inspired by a supplied jellyfish reference credited on screen to
`@dwcminh.ascii`. This review did not independently establish the reference's
license or authorship, and does not reproduce the reference video or source code
visible in it. Existing imported assets are user-supplied project material;
their presence does not constitute an independent rights clearance.

No license grant was present in the inspected import. The package is marked
`private: true` and `license: UNLICENSED` while the owner decides its release
license and confirms code, recording, font and reference provenance. This file
does not grant rights or assert ownership of third-party material.

`ascii-animals-review@0.0.0-review.0` is a local tarball review identifier. Registry
name availability, scope ownership and package availability were not checked.
No npm publication or remote repository mutation was performed by this review.
