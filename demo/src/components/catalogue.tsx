'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BASE_PATH, animals, animalPath, numberOf } from '../lib/catalogue';

const habitats = ['All habitats', 'Ocean', 'Shore', 'Land', 'Air'];

export function Catalogue() {
  const [query, setQuery] = useState('');
  const [habitat, setHabitat] = useState('All habitats');
  const [ready, setReady] = useState(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get('q') ?? '');
      const value = params.get('habitat') ?? 'All habitats';
      setHabitat(habitats.includes(value) ? value : 'All habitats');
    };
    restore();
    setReady(true);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function update(q: string, h: string) {
    setQuery(q); setHabitat(h);
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    if (h !== 'All habitats') url.searchParams.set('habitat', h); else url.searchParams.delete('habitat');
    window.history.replaceState(window.history.state, '', url);
  }

  const visible = animals.filter(animal =>
    animal.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (habitat === 'All habitats' || animal.habitat === habitat));

  return <section id="catalogue" className="catalogue" tabIndex={-1} aria-labelledby="catalogue-title">
    <div className="section-heading">
      <div><p className="eyebrow">The field guide</p><h2 id="catalogue-title">Browse the animals.</h2></div>
      <p>Search by name or browse four habitats. Each animal has its own interactive study.</p>
    </div>
    <div className="catalogue-filters" hidden={!ready}>
      <label>Find an animal<input ref={search} type="search" value={query} onChange={e => update(e.target.value, habitat)} placeholder="Search the collection…" /></label>
      <label>Habitat<select value={habitat} onChange={e => update(query, e.target.value)}>{habitats.map(h => <option key={h} value={h}>{h}</option>)}</select></label>
      <button type="button" className="button quiet" onClick={() => { update('', 'All habitats'); search.current?.focus(); }}>Reset filters</button>
    </div>
    <p className="result-count" role="status">{visible.length} {visible.length === 1 ? 'animal' : 'animals'} <span aria-hidden="true">/</span> {animals.length} in the collection</p>
    <div className="animal-grid">
      {visible.map(animal => <article className="animal-card" key={animal.id} id={animal.anchor}>
        <div className="card-art">
          {/* The named study link and heading supply the accessible name; this preview is decorative. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE_PATH}/field-guide/${animal.id}.webp`} width={384} height={216} alt="" loading="lazy" />
        </div>
        <div className="card-copy">
          <div className="card-meta"><span>{numberOf(animal)} <span aria-hidden="true">/</span> {animal.habitat}</span><span className="card-dot" aria-hidden="true" /></div>
          <h3>{animal.name}</h3>
          <p>{animal.description}</p>
          <Link className="study-link" href={animalPath(animal.id)} prefetch={false} aria-label={`Open ${animal.name} study`}><span>Open study</span><span aria-hidden="true">↗</span></Link>
        </div>
      </article>)}
    </div>
    {visible.length === 0 && <div className="empty-state"><h3>No animals found.</h3><p>Try another name or choose all habitats.</p><button className="button" onClick={() => { update('', 'All habitats'); search.current?.focus(); }}>Show all animals</button></div>}
  </section>;
}
