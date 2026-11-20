import type { SpeciesId } from './renderers';

export const BASE_PATH = '/ascii-animals';
export const REPOSITORY = 'https://github.com/castlemilk/ascii-animals';

export interface Animal {
  readonly id: SpeciesId;
  readonly name: string;
  readonly habitat: 'Ocean' | 'Shore' | 'Land' | 'Air';
  readonly description: string;
  readonly legacy: string;
  readonly anchor: string;
  readonly api: string;
  readonly fieldStudy?: { readonly title: string; readonly path: string };
}

// Catalogue order and original destinations are grounded in dist/index.html.
// This is navigation metadata; it imports no renderer at runtime.
export const animals: readonly Animal[] = [
  { id: 'cuttlefish', name: 'Cuttlefish', habitat: 'Ocean', description: 'A curious visitor with rippling fins and clouds of character ink.', legacy: '/cuttlefish-demo.html', fieldStudy: { title: 'Cuttlefish Field Study', path: '/cuttlefish-study.html' }, anchor: 'cuttlefish', api: 'TYPESCRIPT-API.md' },
  { id: 'manta', name: 'Manta ray', habitat: 'Ocean', description: 'A wide-winged silhouette, built around gliding and banking.', legacy: '/animals.html?species=manta', fieldStudy: { title: 'Manta Reef Glide', path: '/manta-reef.html' }, anchor: 'manta-ray', api: 'SPECIES.md' },
  { id: 'octopus', name: 'Octopus', habitat: 'Ocean', description: 'Eight expressive arms and an appetite for curious encounters.', legacy: '/animals.html?species=octopus', fieldStudy: { title: 'Octopus Den', path: '/octopus-den.html' }, anchor: 'octopus', api: 'SPECIES.md' },
  { id: 'seahorse', name: 'Seahorse', habitat: 'Ocean', description: 'An upright silhouette, a curled tail, and delicate fin motion.', legacy: '/seahorse/index.html', anchor: 'seahorse', api: 'SEAHORSE-API.md' },
  { id: 'crab', name: 'Crab', habitat: 'Shore', description: 'Sideways steps, articulated claws, and a defensive stance.', legacy: '/crab/index.html', anchor: 'crab', api: 'CRAB-API.md' },
  { id: 'turtle', name: 'Sea turtle', habitat: 'Ocean', description: 'A patterned shell and slow, sweeping flipper strokes.', legacy: '/turtle/index.html', anchor: 'sea-turtle', api: 'TURTLE-API.md' },
  { id: 'pufferfish', name: 'Pufferfish', habitat: 'Ocean', description: 'A compact swimmer with a distinctive inflation response.', legacy: '/pufferfish/index.html', anchor: 'pufferfish', api: 'PUFFERFISH-API.md' },
  { id: 'frog', name: 'Frog', habitat: 'Land', description: 'A quiet crouch, a spring, and a soft landing.', legacy: '/frog/index.html', anchor: 'frog', api: 'FROG-API.md' },
  { id: 'butterfly', name: 'Butterfly', habitat: 'Air', description: 'Paired wings, fluttering flight, and gentle landings.', legacy: '/butterfly/index.html', anchor: 'butterfly', api: 'BUTTERFLY-API.md' },
  { id: 'dragonfly', name: 'Dragonfly', habitat: 'Air', description: 'Four wings, hovering precision, and darting flight.', legacy: '/dragonfly/index.html', anchor: 'dragonfly', api: 'DRAGONFLY-API.md' },
  { id: 'gecko', name: 'Gecko', habitat: 'Land', description: 'Splayed toes, a curling tail, and surface exploration.', legacy: '/gecko/index.html', anchor: 'gecko', api: 'GECKO-API.md' },
  { id: 'owl', name: 'Owl', habitat: 'Air', description: 'A watchful text-rendered study with an expressive head turn.', legacy: '/owl/index.html', anchor: 'owl', api: 'OWL-API.md' },
  { id: 'fox', name: 'Fox', habitat: 'Land', description: 'Alert ears, a sweeping tail, and a playful pounce.', legacy: '/fox/index.html', anchor: 'fox', api: 'FOX-API.md' },
];

export function animalPath(id: SpeciesId): string { return `/animals/${id}/`; }
export function originalPath(animal: Animal): string { return `${BASE_PATH}${animal.legacy}`; }
export function apiPath(animal: Animal): string { return `${REPOSITORY}/blob/main/docs/${animal.api}`; }
export function findAnimal(id: string): Animal | undefined { return animals.find(animal => animal.id === id); }
export function numberOf(animal: Animal): string { return String(animals.indexOf(animal) + 1).padStart(2, '0'); }
