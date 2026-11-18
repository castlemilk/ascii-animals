#!/usr/bin/env python3
"""Bundle this buildless site into one editable HTML file; no runtime dependencies."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
html = (dist / 'index.html').read_text()
css = (dist / 'styles.css').read_text()
# Fonts are an optional enhancement on the hosted page. The standalone file
# uses local serif/sans/monospace fallbacks, so it works without a connection.
css = re.sub(r"@import url\([^;]+;\s*", '', css, count=1)
engine = (dist / 'artwork.js').read_text().replace('</script', '<\\/script')
app = (dist / 'app.js').read_text().replace('</script', '<\\/script')
html = html.replace('<html lang="en">', '<html lang="en" data-standalone="true">')
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
html = html.replace('  <script src="artwork.js" defer></script>\n', '')
html = html.replace('  <script src="app.js" defer></script>\n', '')
html = html.replace('</body>', '<script data-artwork-source>\n' + engine + '\n</script>\n<script>\n' + app + '\n</script>\n</body>')
(dist / 'cuttlefish.html').write_text(html)
print(f'Built dist/cuttlefish.html ({len(html.encode()):,} bytes)')
