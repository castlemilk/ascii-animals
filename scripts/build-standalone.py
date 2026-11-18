#!/usr/bin/env python3
"""Compatibility entry point: regenerate all browser artifacts from canonical ESM."""
from pathlib import Path
import subprocess
subprocess.run(['node', str(Path(__file__).resolve().parent / 'build-demo.mjs')], check=True)
