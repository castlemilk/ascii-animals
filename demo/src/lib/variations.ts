import type { SpeciesId } from './renderers';

export type VariationId = 'original' | 'pocket-trickster';

export const availableVariations = {
  original: { name: 'Original', description: null },
  'pocket-trickster': {
    name: 'Pocket Trickster',
    description: 'An elastic little octopus. Offer a hand to invite an arm out, or tap to trigger an ink puff and peek.',
  },
} as const;

export function hasVariations(species: SpeciesId): boolean {
  return species === 'octopus';
}

/** Reject ambiguous values without altering the visitor's URL. */
export function readVariation(species: SpeciesId, search: string): VariationId {
  if (!hasVariations(species)) return 'original';
  const values = new URLSearchParams(search).getAll('variation');
  return values.length === 1 && values[0] === 'pocket-trickster' ? values[0] : 'original';
}

/** Keep the static species route, unrelated parameters and fragment. */
export function variationHref(location: Pick<Location, 'pathname' | 'search' | 'hash'>, variation: VariationId): string {
  const search = new URLSearchParams(location.search);
  if (variation === 'original') search.delete('variation');
  else search.set('variation', variation);
  const query = search.toString();
  return location.pathname + (query ? '?' + query : '') + location.hash;
}
