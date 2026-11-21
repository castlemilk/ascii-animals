import type { OwlGrid, OwlSample } from '../../types.js';

/** Presentation only: exported text and logical cells are never recoloured or changed. */
export const OWL_PALETTE = Object.freeze({
  feather: '#c39752', cream: '#f4e6bd', wing: '#b98a4b', gold: '#e8bd69', habitat: '#819887',
});
export type OwlInk = keyof typeof OWL_PALETTE;
export type OwlInkRun = Readonly<{ text: string; ink: OwlInk }>;

export function owlCellInk(sample: OwlSample | null | undefined): OwlInk {
  if (!sample || sample.part === 'perch') return 'habitat';
  if (sample.material === 'highlight' || sample.material === 'eye' || sample.material === 'disk') return 'cream';
  if (sample.material === 'beak' || sample.material === 'foot') return 'gold';
  if (sample.part === 'wing-left' || sample.part === 'wing-right' || sample.part === 'tail') return 'wing';
  return 'feather';
}

/** Coalesce adjacent ink runs, keeping whitespace with its previous run. No HTML. */
export function owlInkRuns(grid: OwlGrid): readonly OwlInkRun[] {
  const runs: { text: string; ink: OwlInk }[] = [];
  let cell = 0;
  for (const char of grid.text) {
    const sample = char === '\n' ? null : grid.samples[cell++];
    const previous = runs[runs.length - 1];
    const ink = (char === ' ' || char === '\n') && previous ? previous.ink : owlCellInk(sample);
    if (previous && previous.ink === ink) previous.text += char;
    else runs.push({ text: char, ink });
  }
  return runs;
}
