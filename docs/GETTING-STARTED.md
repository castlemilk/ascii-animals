# Build and run a browser example

The package at the verified source is
**`ascii-animals-review@0.0.0-review.0`**, a private local review candidate. These
instructions build that source and install its tarball. The npm name
`ascii-animals` is a different project; it cannot be used for these examples.
See [Package contract](PACKAGE.md) for the registry check and export map.

## Prerequisites and source

Use Node.js **20 or newer**, npm, Git, and Python 3 for the standard-library HTTP
server below. Node's engine requirement comes from `package.json`; it is a build
tool requirement, not a promise that the browser renderer works on the server.
The commands use a POSIX shell, suitable for macOS or Linux.

The reviewed runtime is pinned to:

```text
repository: https://github.com/castlemilk/ascii-animals
default branch: main
source: f63b20e2045b1070b10bde2efc4eb3a8536e606b
```

Use a checkout containing this documentation change. During draft review, the
documentation branch below includes the new guides and runnable examples:

```sh
git clone --branch docs/developer-guides-20261121 \
  https://github.com/castlemilk/ascii-animals.git
cd ascii-animals
git rev-parse HEAD
```

After the documentation is merged, use the branch containing it. The documentation
commit differs from the runtime baseline above but changes no runtime source.
For an exact source-plus-patch reproduction, check out the baseline in a separate
checkout and apply the downloaded docs patch with `git apply --check` followed by
`git apply`. Do not detach a documentation checkout at the old baseline and then
expect the new examples to remain present. For any newer runtime revision, record
its commit and rerun validation; the version string alone does not identify source.

## Build and pack explicitly

Run these commands from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm pack --dry-run --json --ignore-scripts
npm pack --json --ignore-scripts --pack-destination ..
```

The first command installs the locked development compiler. The build generates
`lib/` and the existing demo outputs from source. `npm pack` packages those built
files; it does not build them or publish them. The explicit build is necessary
because these pack commands suppress lifecycle scripts. The expected tarball is
`../ascii-animals-review-0.0.0-review.0.tgz`.

The current package has no runtime dependencies. Its `files` allowlist includes
`lib/`, root README/notice material and top-level `docs/*.md`; **the nested runnable
examples and verification scripts are source-checkout files, not tarball
contents**. Copy them separately in the next step. The package's privacy,
publication guard and license fields remain unchanged.

## Install into a separate consumer

This uses the complete basic and director examples in
[`docs/examples/browser/`](examples/browser/). It avoids workspace symlinks and
does not require a bundler or CDN.

```sh
# Still at the repository root:
ASCII_REPO="$(pwd)"
ASCII_TARBALL="$ASCII_REPO/../ascii-animals-review-0.0.0-review.0.tgz"
ASCII_DEMO="$(mktemp -d)"
cp -R "$ASCII_REPO/docs/examples/browser/." "$ASCII_DEMO/"
cd "$ASCII_DEMO"
npm install --offline --ignore-scripts --no-audit --no-fund \
  --save-exact "$ASCII_TARBALL"
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the basic example](http://127.0.0.1:8000/) or
[the director example](http://127.0.0.1:8000/director.html). Keep the server running;
stop it with Ctrl+C when finished. If port 8000 is occupied, choose another port
and use it in both URLs. Serve over HTTP; opening the files with `file://` is not
the supported module-loading setup.

The browser does not understand Node's package resolution or `package.json`
export map. The examples' import maps explicitly map each bare import to the
corresponding JavaScript target from the installed tarball. Relative imports
inside `lib/` then resolve normally. TypeScript and bundlers use the package's
export map instead. When upgrading, check these import-map targets against the
new manifest rather than guessing internal paths.

The only network requests the running examples need are local HTML, CSS and
JavaScript files. The earlier `npm ci` may need registry access for the development
compiler; the local package installation above uses offline mode.

## What the examples demonstrate

| Example | Entry and behavior | Cleanup |
| --- | --- | --- |
| [Basic source](examples/browser/basic.js) | Root `createArtwork`; a reactive cuttlefish; strict options; Play/Pause/Restart/Startle; omitted `paused` honors the initial system preference | `dispose()` plus aborting host control listeners |
| [Director source](examples/browser/director.js) | `/cuttlefish` `createMarineDirector`; manta/octopus/cuttlefish cast; explicit octopus focus; left/right invitations, release, disturbance and an Explore still | `destroy()` plus aborting host control listeners |

Each page owns a nonzero CSS canvas size, accessible description, native buttons,
visible loading/error status, and explicit Mount/Dispose controls. The director
opens paused and demonstrates a useful interaction that can compose a still.
Its invitation coordinates are in `-0.5` to `0.5`, measured from the canvas center.
Startle/disturb does not choose Play on the user's behalf.

Native buttons provide Tab focus and Enter/Space activation, including when the
canvas itself has no keyboard handler. Touch can activate the same controls.
These are host controls supplied by the examples; the package does not render
them automatically. Do not generalize this marine example's reduced-motion,
timing or lifecycle behavior to every animal. Use [Animal APIs](ANIMAL-APIS.md)
for those differences.

These small pages demonstrate package integration. They are not a replacement
for the Next.js gallery, an official framework adapter, or a new published animal
variant. They use the runtime in the installed tarball.

## Using a framework or bundler

In an existing browser application, install the same tarball, then use the bare
imports shown in the examples. A bundler resolves the package export map, so the
HTML import map is unnecessary in that setup. For TypeScript, use a resolution
mode that understands package exports, such as `NodeNext` or `Bundler`, and
include the DOM library for root and animal artwork types. The `/core` scheduler
entry has a documented DOM-free type-consumer check; this does not imply that
other pure subpaths, such as `/movement`, require browser ambient declarations.

Importing is SSR-safe; construction requires an actual browser host. Construct
after mount, retain one instance, update it through the appropriate species API,
and dispose it during cleanup. The [browser integration guide](BROWSER-INTEGRATION.md)
includes a complete typed mount helper and explains framework effect lifecycles,
resizing, reduced motion, zero-size recovery, route changes and disposal.

## Verify the documented examples

From the documentation checkout, after building and packing, run:

```sh
node docs/verify-examples.mjs \
  ../ascii-animals-review-0.0.0-review.0.tgz
```

The checker installs the supplied tarball into an isolated consumer and checks
the documentation examples against its actual exports and declarations. See the
script's usage and the [dated validation record](VALIDATION-2026-11-21.md) for the
browser checker invocation, exact commands, package digest, observed results and
the difference between type checking and browser execution.

## Common setup failures

| Symptom | Check |
| --- | --- |
| Browser cannot resolve `ascii-animals-review` | Use the supplied import map, or a bundler; bare imports alone do not make a native browser resolve npm packages |
| JavaScript target is missing | Build before packing, inspect the tarball, and reinstall the new local artifact |
| Canvas is blank or stays suspended | Give it a nonzero CSS box, ensure Canvas 2D exists, and check page/viewport visibility and pause state |
| Animation stays still | Inspect system reduced motion and the species-specific playback policy; the director sample intentionally starts paused |
| An option or method fails | Match the factory and subpath to that animal's API; `dispose()`/`destroy()`, seconds/ticks, and option nesting differ |
| npm installs a different ASCII project | Use the exact local `ascii-animals-review` tarball; do not install `ascii-animals` as a substitute |
| An import works in source but fails as a consumer | Use a declared export path; private `lib/` package subpaths and study-only modules are not public Node imports |
