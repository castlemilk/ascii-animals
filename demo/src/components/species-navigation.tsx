'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { animals, animalPath, numberOf } from '../lib/catalogue';
import type { SpeciesId } from '../lib/renderers';

export function SpeciesNavigation({ selected }: { selected: SpeciesId }) {
  const router = useRouter();
  const [pending, setPending] = useState(selected);
  return <>
    <nav className="species-rail" aria-label="Animals"><p className="eyebrow">The collection</p><ol>{animals.map(animal => <li key={animal.id}>
      <Link href={animalPath(animal.id)} prefetch={false} aria-current={selected === animal.id ? 'page' : undefined}><span className="species-number" aria-hidden="true">{numberOf(animal)}</span><span>{animal.name}</span>{selected === animal.id && <span className="active-dot" aria-hidden="true" />}</Link>
    </li>)}</ol></nav>
    <form className="mobile-species" aria-label="Jump to a species" onSubmit={event => { event.preventDefault(); router.push(animalPath(pending)); }}><label>Choose an animal<select value={pending} onChange={e => { const animal = animals.find(item => item.id === e.target.value); if (animal) setPending(animal.id); }}>
      {animals.map(animal => <option key={animal.id} value={animal.id}>{numberOf(animal)} — {animal.name}</option>)}
    </select></label><button className="button" type="submit"><span>Open</span><span className="sr-only"> selected study</span><span aria-hidden="true"> ↗</span></button></form>
    <noscript><style>{'.mobile-species{display:none!important}'}</style><nav className="no-script-species" aria-label="Animals without JavaScript"><p className="eyebrow">Choose an animal</p><ul>{animals.map(animal => <li key={animal.id}><Link href={animalPath(animal.id)} prefetch={false} aria-current={selected === animal.id ? 'page' : undefined}>{animal.name}</Link></li>)}</ul></nav></noscript>
  </>;
}
