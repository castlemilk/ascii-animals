import type { Metadata } from 'next';
import { BASE_PATH } from './catalogue';

// The repository's published Pages URL. Do not infer this from a preview host
// or window.location: filters and tracking parameters are not separate pages.
export const SITE_ORIGIN = 'https://castlemilk.github.io';
export const SITE_NAME = 'ASCII Animals';

/** Accept a project-relative, clean path; add the Pages base path exactly once. */
export function siteUrl(route: string): string {
  if (!route.startsWith('/') || route.startsWith('//') || /[?#\\]/.test(route)
    || route === BASE_PATH || route.startsWith(`${BASE_PATH}/`)
    || route.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Expected a clean project-relative path: ${route}`);
  }
  return `${SITE_ORIGIN}${BASE_PATH}${route}`;
}

// Page metadata is deliberately not exported by the shared layout. In
// particular, the catalogue canonical must never be inherited by a 404.
export function pageMetadata(title: string, description: string, route: string): Metadata {
  const url = siteUrl(route);
  const image = {
    url: siteUrl('/social-preview.png'),
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: 'ASCII Animals — interactive ASCII art, JavaScript library and TypeScript types.',
  };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
