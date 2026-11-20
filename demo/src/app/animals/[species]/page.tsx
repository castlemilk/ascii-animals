import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '../../../components/site-shell';
import { SpeciesNavigation } from '../../../components/species-navigation';
import { StudyStage } from '../../../components/study-stage';
import { animals, animalPath, findAnimal, numberOf } from '../../../lib/catalogue';

type PageProps = { params: Promise<{ species: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return animals.map(animal => ({ species: animal.id })); }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const animal = findAnimal((await params).species);
  return { title: animal ? `${animal.name} study` : 'Study not found', description: animal?.description };
}

export default async function SpeciesPage({ params }: PageProps) {
  const animal = findAnimal((await params).species);
  if (!animal) notFound();
  const index = animals.indexOf(animal);
  const previous = animals[index - 1], next = animals[index + 1];
  return <main id="main-content" className="study-page" tabIndex={-1}>
    <Breadcrumbs animal={animal} />
    <Link className="back-link" href="/#catalogue" prefetch={false}><span aria-hidden="true">←</span> Back to catalogue</Link>
    <div className="study-heading"><div><p className="eyebrow">{numberOf(animal)} / {animals.length} <span aria-hidden="true">·</span> {animal.habitat}</p><h1 tabIndex={-1}>{animal.name}<span className="heading-period" aria-hidden="true">.</span></h1></div><p>{animal.description}</p></div>
    <div className="study-layout"><SpeciesNavigation key={animal.id} selected={animal.id} /><div className="study-content"><StudyStage key={animal.id} animal={animal} />
      <nav className="adjacent-navigation" aria-label="Previous and next animals">
        {previous ? <Link href={animalPath(previous.id)} prefetch={false} aria-label={`Previous: ${previous.name}`}><span className="eyebrow">← Previous</span><strong>{previous.name}</strong></Link> : <span className="collection-boundary">The first in the collection</span>}
        {next ? <Link href={animalPath(next.id)} prefetch={false} aria-label={`Next: ${next.name}`}><span className="eyebrow">Next →</span><strong>{next.name}</strong></Link> : <Link href="/#catalogue" prefetch={false}><span className="eyebrow">Collection complete</span><strong>Return to the catalogue ↑</strong></Link>}
      </nav>
    </div></div>
  </main>;
}
