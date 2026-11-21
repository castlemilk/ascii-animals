import type { MetadataRoute } from 'next';
import { animals, animalPath } from '../lib/catalogue';
import { siteUrl } from '../lib/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  // Studios are preserved as distinct experiences, not aliases of these routes.
  // No build-time lastModified: a rebuild is not evidence of a content change.
  return ['/', ...animals.map(animal => animalPath(animal.id))].map(route => ({ url: siteUrl(route) }));
}
