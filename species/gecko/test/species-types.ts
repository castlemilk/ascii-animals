import { geckoSpecies } from '../src/species.js';
import type { GeckoSpecies, GeckoSample, GeckoGeometryResult } from '../src/species.js';
const definition: GeckoSpecies = geckoSpecies;
const specimen = definition.create({ seed: 37, options: { toeSpread: 1.1 } });
const result: GeckoGeometryResult = definition.sample(specimen.getSnapshot(), (point: GeckoSample) => { void point; });
const anatomy = definition.anatomy(specimen.getSnapshot());
// @ts-expect-error Species identity is a read-only literal.
geckoSpecies.id = 'ray';
// @ts-expect-error Local GeckoConfig is not a nonexistent registry contract.
definition.create({ species: 'gecko' });
void [result, anatomy];
specimen.dispose();
