# Source and platform references

Inspected on 18 November 2026. Repository facts and runtime claims must be attached to the appropriate source layer.

## Project source layers

| Layer | Evidence | What it establishes / does not establish |
| --- | --- | --- |
| GitHub initial main | `84bd1f84fab0f5f5dec053c0d10562c10be8c188` | Initial main had `.gitignore` only. It did not contain the microsite or an npm package. |
| GitHub import base | [Commit `7e5984d34a139b8de4643f1ed0607897a42d88dc`](https://github.com/castlemilk/ascii-animals/commit/7e5984d34a139b8de4643f1ed0607897a42d88dc), branch `feat/cuttlefish-microsite-import`, draft PR #1 | Exact base for this review's patches. Imported 21 blobs match local snapshot; hosting metadata excluded. |
| Local microsite draft | `afcce9941c5fa13ca5c658564e73388e603dff14` | Read-only archived source used for detailed inspection. Equivalent imported code is in the import base. Newer than accessible saved v4. |
| Saved site version 4 | `6214a09171fa328beec984edd6533c33e83ce9f1` | Site metadata/source provenance, not a new browser execution test. |
| Supplied conversation | [Conversation](https://chatgpt.com/c/6afd2c72-71ec-83ec-b182-835c5e7f86b1) | Site metadata links this conversation to the Cuttlefish project. Full transcript access was blocked (HTTP 403; search fetch disabled). Contents were not inferred from the title. |
| Live site | [Cuttlefish / In the Current](https://cuttlefish-in-the-current.shorted-com-au.chatgpt.site/) | Direct access returned HTTP 403 in this review. No current runtime parity or browser benchmark is claimed from that URL. |
| Candidate | Local review artifacts and their manifest | Proposed source edits and recorded local tests only. No remote push, site deployment, or npm publication. |

The imported README's origin statement is source testimony, not an independent licensing verification. The reference video itself was not inspected as part of this Track 2 source/package audit. Existing media files are retained as imported assets; no external artwork was copied into the candidate.

Useful immutable source links:

- [Renderer](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/dist/artwork.js)
- [Microsite controls](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/dist/app.js)
- [HTML integration](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/dist/index.html)
- [Recorder](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/dist/record.html)
- [Numerical checks](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/scripts/check-engine.cjs)
- [Standalone builder](https://github.com/castlemilk/ascii-animals/blob/7e5984d34a139b8de4643f1ed0607897a42d88dc/scripts/build-standalone.py)

## Current official platform references

These references support package/framework/browser mechanics. They do not prove that the candidate has passed a compatibility test.

| Reference | Used for |
| --- | --- |
| [Node.js package documentation](https://nodejs.org/api/packages.html) | ESM package type, explicit subpath exports, export boundaries, and the need to treat CommonJS support as a separate tested choice. |
| [npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) | Package metadata, private flag, files allowlist, and license declaration. |
| [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) | Local tarball creation, dry-run/JSON output, and script policy. |
| [TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html) | Declaration/export resolution under NodeNext and Bundler modes. |
| [webpack tree-shaking guide](https://webpack.js.org/guides/tree-shaking/) | Static ESM structure, `sideEffects` semantics, and production bundle verification. |
| [React useEffect](https://react.dev/reference/react/useEffect) | Client-only effects, cleanup ownership, and development setup/cleanup checks. |
| [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | One-shot frame requests, timestamp-based progression, display refresh variation, and typical background suspension. |
| [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Document visibility signals and browser background scheduling policies. |

Architecture choices, proposed budgets, backlog priorities, and resource-bound formulas are recommendations from this review. They are labeled as proposals or calculations rather than attributed to platform documentation as universal requirements.
