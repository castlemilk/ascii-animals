import type { SpeciesId } from './renderers';

export const availableVariations = {
  original: { name: 'Original', description: null },
  'pocket-trickster': {
    name: 'Pocket Trickster',
    description: 'An elastic little octopus. Offer a hand to invite an arm out, or tap to trigger an ink puff and peek.',
  },
  'ink-puppet': {
    name: 'Ink Puppet',
    description: 'A cuttlefish with curious arms and a quick retreat. Invite it to investigate or see it vanish behind a cloud of ink.',
  },
} as const;

export type VariationId = keyof typeof availableVariations;

const alternates: Partial<Record<SpeciesId, Exclude<VariationId, 'original'>>> = {
  cuttlefish: 'ink-puppet',
  octopus: 'pocket-trickster',
};

export function alternateFor(species: SpeciesId) {
  return alternates[species];
}

/** Reject ambiguous or cross-species values without altering the visitor's URL. */
export function readVariation(species: SpeciesId, search: string): VariationId {
  const alternate = alternateFor(species);
  if (alternate === undefined) return 'original';
  const values = new URLSearchParams(search).getAll('variation');
  return values.length === 1 && values[0] === alternate ? alternate : 'original';
}

/** Keep the static species route, unrelated parameters and fragment. */
export function variationHref(location: Pick<Location, 'pathname' | 'search' | 'hash'>, variation: VariationId): string {
  const search = new URLSearchParams(location.search);
  if (variation === 'original') search.delete('variation');
  else search.set('variation', variation);
  const query = search.toString();
  return location.pathname + (query ? '?' + query : '') + location.hash;
}
