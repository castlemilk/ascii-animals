# Reproducible performance checks

These fixtures require no runtime dependency installation and never publish or contact a package registry.

## Node CPU paths

Run from the repository root:

```sh
# The imported baseline classic-script renderer (default source).
node bench/benchmark.cjs --out baseline.json

# The proposed ESM library and its explicit manual time driver.
node bench/benchmark.cjs \
  --source src/animals/cuttlefish.js --esm \
  --out candidate.json
```

Defaults are 947×707 CSS pixels, DPR 1, density 1.1, glow on, independent reactive scenes, and populations 1/4/12. Each population gets five repetitions of 45 warmup plus 120 measured callbacks. `--width`, `--height`, `--dpr`, `--warmup`, `--frames`, and `--repetitions` can override those settings. Preserve the JSON, source hashes, Node/V8 and CPU metadata, and exact command.

The engine's actual simulation, procedural geometry, projection, and glyph-grid loops run, but Canvas calls are no-ops. **These measurements exclude browser rasterization, fonts, blur, GPU, presentation and power. Do not report them as FPS.** Process CPU includes runtime helper work; shared-host wall tails are noisy.

The baseline uses its queued-rAF driver. The candidate uses `autoStart:false` and `advance(seconds)`. Their scheduler overhead differs. The supplied measurements demonstrate no CPU rendering speed improvement. Match workloads and use controlled, repeated, preferably interleaved measurements before making a relative performance claim. There is no ink in the default Node workload.

## Real Canvas fixture — supplied, not executed in this review

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/bench/browser-benchmark.html`. Keep the default local module path, select population/scenario, press Run, then download JSON. The fixture imports a same-origin module, explicitly opts into motion, takes 60 warmup and 600 measured frames, and aborts if the tab becomes hidden. It covers roaming, lens encounter, and startle/ink. Pointer input is disabled on its canvas to keep accidental mouse movement out of the workload.

It measures synchronous `advance(1/60)` duration and rAF intervals separately. **Canvas return time does not wait for GPU completion.** Optional browser heap counters do not include canvas/GPU memory and do not establish leak freedom. Record the exact source commit, device, browser version, dimensions, effective DPR, and visual observations with every JSON result.

Before release, run named desktop and mobile browsers, multiple sizes/DPRs, glow/points mode, repeated mounting/disposal, resizes, visibility and reduced-motion transitions, and high-rate input. Treat frame and memory targets as proposed budgets until those runs establish a supported device envelope.
