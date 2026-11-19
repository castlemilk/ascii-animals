import Link from 'next/link';
import { Breadcrumbs } from '../components/site-shell';
import { Catalogue } from '../components/catalogue';
import { BASE_PATH, REPOSITORY } from '../lib/catalogue';

export default function HomePage() {
  return <main id="main-content" tabIndex={-1}>
    <Breadcrumbs />
    <section className="hero" aria-labelledby="title">
      <div><p className="eyebrow">A living character collection <span aria-hidden="true">/</span> 001—013</p>
        <h1 id="title" tabIndex={-1}>Small characters.<br /><em>Wild personalities.</em></h1>
        <p className="hero-description">A little code. A lot of character.<br />Meet thirteen creatures with a life of their own.</p>
        <div className="hero-actions"><Link className="button primary" href="/animals/cuttlefish/" prefetch={false}>Meet the cuttlefish <span aria-hidden="true">↗</span></Link><a className="text-link" href="#catalogue">Explore the collection <span aria-hidden="true">↓</span></a></div>
      </div>
      <aside className="field-note" aria-label="About the collection"><span className="specimen-mark" aria-hidden="true">{'{a}'}</span><div className="field-note-rule" /><p className="eyebrow">Observed in characters</p><p>From the ocean floor<br />to the garden wall.</p><span className="field-note-caption">13 studies · one field guide</span></aside>
    </section>
    <Catalogue />
    <section id="library" className="library-section" tabIndex={-1} aria-labelledby="library-title"><div><p className="eyebrow">For the curious</p><h2 id="library-title">Take a closer look.</h2><p>Explore the animal APIs and original studios, or keep a standalone cuttlefish study to open offline.</p><p className="small-note">The library is a private review package. Local build instructions are in the repository.</p></div><div className="library-links"><a href={`${REPOSITORY}/blob/main/docs/ANIMAL-APIS.md`}>Read the animal APIs <span aria-hidden="true">↗</span></a><a href={`${BASE_PATH}/cuttlefish.html`} download="cuttlefish.html">Download the cuttlefish study <span aria-hidden="true">↓</span></a><a href={REPOSITORY}>Explore the source <span aria-hidden="true">↗</span></a></div></section>
  </main>;
}
