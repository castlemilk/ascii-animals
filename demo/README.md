# ASCII Animals: Next.js demo consumer

An additive Next.js App Router shell for the existing GitHub Pages project at
`/ascii-animals`. This app consumes the **built, private** `ascii-animals-review`
package through its public exports. It introduces no renderer implementation,
iframe, movement engine, species geometry or library publishing change.

Integrated against the 13-species uplift on `main` (`59bd5be`).

## Run locally

From the repository root, using Node >=20.9 (validated with Node 24.22.3):

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix demo ci --ignore-scripts --no-audit --no-fund
npm --prefix demo run build
npm --prefix demo run serve
```

Open `http://127.0.0.1:4173/ascii-animals/`. The provided server serves the static
export with the real project base path. It does not turn missing routes into
successful catalogue responses. `PORT=4175 npm --prefix demo run serve` selects
another local port if necessary.

For development, build the package first with `npm run build`, then run
`npm --prefix demo run dev` and open `http://localhost:3000/ascii-animals/`.
Original studios are assembled into the **export**, so validate their URLs with
`run build` + `run serve`; `next dev` does not expose those compatibility files.

The consumer dependency is `file:..`; npm resolves the local package's public
`exports` to generated `lib/` JavaScript and declarations. There are no path
aliases to `src/`. The local package is private and unpublished; these are not
npm-registry installation or publication instructions.

## Navigation and static output

- `/ascii-animals/` is the catalogue, with name/habitat filtering and real links.
- `/ascii-animals/animals/[species]/` is generated for each of the thirteen
  built-in species by `generateStaticParams()`.
- `basePath: '/ascii-animals'`, `output: 'export'` and `trailingSlash: true`
  produce real HTML files for direct entry and refresh on a static host.
- Breadcrumbs are visible. Desktop species links identify the current page.
  The mobile native selector has an explicit **Open selected study** button.
- Previous/Next follows catalogue order and does not wrap. Back to catalogue is
  a deterministic parent link, including on direct entry.
- Client route changes focus the new heading, or the requested catalogue/library
  fragment. Navigation has visible focus and a skip link; no global key listener
  is added.
- Catalogue links and species navigation remain usable with JavaScript disabled.
  The animation itself needs JavaScript and has a readable explanation.

The postbuild script retains all existing `dist/` files **except its root
`index.html`**, which is replaced by the Next catalogue. Existing studios,
query strings, fragment links and standalone downloads therefore keep their
original behavior. They are independent pages; the new shell never imports
their bundles. `legacy-manifest.json` records every retained file's bytes/hash.

The original full studios stay one click away from each new study. The three
authored marine studies are also linked from their species page. This does not
migrate all native controls into the common surface. The manual GitHub Pages
workflow assembles and uploads one site from `demo/out`; it is not triggered by
merging demo code.

## Renderer ownership and motion

`src/lib/renderers.ts` contains the only runtime factory imports. It lazily
selects the actual public factory for the active species. The three marine
species share `createArtwork`; the other ten have their own public subpaths.
Owl owns a DOM-text host. The others borrow a canvas created by the shell.

Construction always starts paused. An abort signal prevents a late import from
mounting after navigation, and disposes an already mounted controller. Cleanup
releases the native controller, media listener and owned element. There is no
shell animation timer or hidden preview renderer.

The shared layout keeps user pause and Still mode across client navigation.
System reduced motion is read before mounting, disables Play and remains an
independent pause cause. After a system reduced-motion preference is removed,
animation stays paused until explicit Play. Restart retains the current policy.
Native visibility and offscreen suspension remain owned by each renderer.

Space is a playback shortcut **only while the artwork itself has focus**. It
does not capture keys on the page, form controls or movement panel. This gives
the shell one predictable playback state instead of allowing native Space
handlers to toggle playback independently. Other species key behavior remains
native; the full original keyboard/control surfaces remain in the studios.

Small-host behavior is not invented by the shell: Gecko pauses below 360 CSS px;
Owl pauses below 350 × 330 CSS px. The controls describe those compact still
views. The marine family and Pufferfish share some implementation bytes, as
documented in the library; one mounted renderer does not mean equal chunk sizes.

## Movement owner: stable plug-in point

`src/extensions/movement-controls.tsx` exports:

```ts
movementControls: {
  configuration: Partial<RendererConfigurations>;
  Panel: ComponentType<MovementPanelProps> | null;
}
```

Configuration types come from each **actual factory parameter** and are applied
before construction. This permits existing directors that require initial
configuration to be enabled without a second renderer. The optional panel gets
the discriminated `RendererSession`, effective pause/reduced-motion state, and
`requestPaused`. Narrow `session.species` before using its native controller.

The movement owner should edit this extension file. If a different native
factory is required, coordinate the corresponding branch in
`src/lib/renderers.ts`. In particular, marine's newer `createMarineDirector`
lives on `/cuttlefish`; the typed `createArtwork` controller does not expose it.
Do not claim that this hook already bridges that distinct factory.

The panel owns its listeners/subscriptions and cleans them on unmount. It must
not instantiate another renderer, dispose the shell's controller or resume it
outside `requestPaused`. Unmount cleanup may encounter an already disposed
controller and must tolerate that. No panel is installed in this patch, so the
empty region is omitted; Original studio remains available.

## Checks

After the build:

```sh
npm --prefix demo run typecheck
npm --prefix demo run test:unit
npm --prefix demo run check:export
npm --prefix demo test
```

Playwright uses an installed supported Chromium by default. If the machine's
supported executable must be selected, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium` for that test invocation.
No alternate security flags are configured. Browser installation and CI setup
belong to the integration owner's normal environment.

The Node tests use actual package factories with simulated DOM bookkeeping;
they do not establish appearance, real keyboard/touch behavior or performance.
The export checker verifies static links, compatibility bytes, bare package
resolution, absence of eager renderer imports and initial factory chunks. Its
chunk check is explicitly tied to this pinned Webpack build format and fails
closed if the format changes.

See [verification](../docs/demo-shell/VERIFICATION.md),
[the pinned design](../docs/demo-shell/DESIGN.md), and
[the integration handoff](../docs/demo-shell/HANDOFF.md).

## GitHub Pages integration boundary

The build artifact is `demo/out/`, containing Next routes, `_next/` assets,
original studio files and `.nojekyll`. Upload that directory as the site root;
do not nest it inside another `ascii-animals` folder. `basePath` supplies the
project prefix in URLs.

The existing manual `.github/workflows/pages.yml` validates the package and
static export before uploading `demo/out`. This change does not run the workflow,
publish the package, or deploy the site.
