# Packed-package consumers

These fixtures are copied into a fresh temporary directory by
`scripts/check-package.mjs`. That directory installs the freshly created local
tarball with npm offline mode and lifecycle scripts disabled. The fixtures do
not resolve the source checkout through a symlink.

| Fixture | What it checks |
| --- | --- |
| `consumer.mjs` | All three public runtime imports without `window`/`document`, root/subpath export identity, declared public method presence, blocked private subpaths. |
| `types.ts` | Browser-facing declarations in strict TypeScript NodeNext and Bundler modes; six expected type failures. This file is compiled, not executed. |
| `types-core-server.ts` | Core declarations with the ES2022 library only, without DOM or Node ambient types. |
| `bundle-core.js` | Direct core import excludes the cuttlefish renderer. |
| `bundle-root-core.js` | Selecting core from the root re-export also excludes the renderer. |
| `bundle-animal.js` | The animal subpath resolves and includes its engine. |
| `bundle-unused.js` | An unused root import is eliminated, leaving only the marker. |

Run from the source checkout:

```sh
npm run check:package
```

Node/pack checks require no dependencies. TypeScript and esbuild checks use
already available tools; the script never installs toolchains. To supply them:

```sh
ASCII_TSC=/absolute/existing/typescript/lib/tsc.js \
ASCII_ESBUILD_MODULE=/absolute/existing/esbuild/lib/main.js \
node scripts/check-package.mjs --report artifacts/package-check.json
```

The report records missing optional checks explicitly. A complete run also
saves the exact tested `.tgz` beside the report. This is local package creation,
not publication. The package remains private.

`HTMLCanvasElement` appears in the root/animal declarations, so their TypeScript
consumers need the DOM library. Use the core subpath in projects that purposely
omit DOM types. All JavaScript entry points are still checked for safe server
import; constructing or rendering an animal requires a browser.

These fixtures do not assert CommonJS distribution, React hydration, other
bundlers, browser pixels, browser performance, device input, or accessibility.
They test a package boundary, not the full visual acceptance matrix.
