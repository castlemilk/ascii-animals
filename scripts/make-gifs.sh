#!/usr/bin/env bash
# Convert a real recording from dist/record.html to an optimized README GIF.
set -euo pipefail

if [[ $# -lt 2 || $# -gt 4 ]]; then
  echo "Usage: $0 input.webm output.gif [width=560] [fps=10]" >&2
  exit 2
fi

input_path=$1
output_path=$2
gif_width=${3:-560}
gif_fps=${4:-10}

if ! [[ "$gif_width" =~ ^[0-9]+$ && "$gif_fps" =~ ^[0-9]+$ ]]; then
  echo "Width and frame rate must be positive integers." >&2
  exit 2
fi
if (( gif_width < 1 || gif_fps < 1 )); then
  echo "Width and frame rate must be positive integers." >&2
  exit 2
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "FFmpeg is required to convert the recording." >&2
  exit 1
fi

mkdir -p "$(dirname "$output_path")"
ffmpeg -hide_banner -loglevel warning -y -i "$input_path" \
  -filter_complex "fps=${gif_fps},scale=${gif_width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  -loop 0 "$output_path"
