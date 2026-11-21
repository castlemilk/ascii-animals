import { writeFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

// Editable, deterministic shared brand card. It uses Next's bundled font,
// needs no network or browser, and is committed as a static PNG for Pages.
// The page-specific title and description remain in each page's metadata.
const card = h('div', { style: {
  width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
  padding: '52px 64px', backgroundColor: '#101713', color: '#e5eddf',
  fontFamily: 'sans-serif',
} },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 20, fontSize: 28 } },
    h('span', { style: { color: '#c4f17d', fontSize: 40 } }, '{a}'), 'ASCII Animals'),
  h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 48, fontSize: 92, lineHeight: 1.02, letterSpacing: '-4px' } },
    h('span', null, 'ASCII by'), h('span', { style: { color: '#c4f17d' } }, 'nature.')),
  h('div', { style: { display: 'flex', marginTop: 28, fontSize: 30, color: '#bac9b3' } }, 'Interactive ASCII art. Thirteen animal studies.'),
  h('div', { style: { display: 'flex', marginTop: 'auto', borderTop: '1px solid #3d493b', paddingTop: 22, fontSize: 24, justifyContent: 'space-between', color: '#bac9b3' } },
    h('span', null, 'JavaScript library · TypeScript types'),
    h('span', { style: { color: '#c4f17d' } }, 'castlemilk.github.io/ascii-animals/')),
);
const response = new ImageResponse(card, { width: 1200, height: 630 });
const destination = new URL('../public/social-preview.png', import.meta.url);
await writeFile(destination, Buffer.from(await response.arrayBuffer()));
console.log(`Generated ${destination.pathname} (1200 × 630 PNG)`);
