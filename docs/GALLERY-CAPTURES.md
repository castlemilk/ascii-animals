# Animal gallery captures

The thirteen GIFs in `docs/media/animals/` are newly captured from the actual
canonical Next.js studies and built package at the source commit in
[`manifest.json`](media/animals/manifest.json). They are not generated illustrations,
old evidence images, mocked canvas output or screen recordings of another site.

## Reproduce

Requires Node, the repository's locked dependencies, Playwright Chromium and ffmpeg.
Use an isolated headless browser, never a person's signed-in profile.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix demo ci --ignore-scripts --no-audit --no-fund
npm --prefix demo run build
PORT=4188 node demo/scripts/serve-export.mjs
# In another terminal:
node scripts/generate-gallery-gifs.mjs http://127.0.0.1:4188
```

The script visits all thirteen `/ascii-animals/animals/<species>/` routes, waits
for the real renderer to be ready, and captures only the artwork host. The host
is set to 560 × 360 CSS pixels with DPR 1, above the Owl and Gecko minimum sizes.
The browser clock advances through 1.6 seconds of settling, then forty frames at
10 fps (four seconds). Animation is enabled; no geometry or renderer code is
changed. Idle behavior and habitat are the actual canonical study defaults.

ffmpeg builds an adaptive 96-colour palette and uses Bayer dithering with
rectangle differencing. All GIFs loop. This balances small review-friendly media
with readable glyphs. A loop boundary is a replay cut, not a promise of seamless
biological motion.

Verification fails if a route is not HTTP 200, the browser reports an uncaught
error, fewer than ten captured or decoded frames differ, the decoded GIF has
anything other than forty frames, or any two GIF file hashes match. The manifest
records source revision, dimensions, frame counts, unique frames, bytes and hashes.
Frames are temporary capture evidence under `/tmp/ascii-gif-frames` by default;
set `FRAMES_DIR` to retain them elsewhere. Only optimized GIFs and the manifest
are committed.

These real-browser pixel captures verify that the artwork is present and moving.
They are not performance benchmarks, exhaustive interaction tests, mobile
acceptance or screen-reader testing. README GIFs autoplay independently of OS
reduced-motion settings; the linked interactive studies provide motion controls.
