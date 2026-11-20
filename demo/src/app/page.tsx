import Link from 'next/link';
import { Breadcrumbs } from '../components/site-shell';
import { Catalogue } from '../components/catalogue';
import { BASE_PATH, REPOSITORY } from '../lib/catalogue';

export default function HomePage() {
  return <main id="main-content" tabIndex={-1}>
    <Breadcrumbs />
    <section className="hero discovery-hero" aria-labelledby="title">
      <div className="discovery-copy">
        <p className="eyebrow">Interactive field guide <span aria-hidden="true">/</span> 13 species</p>
        <h1 id="title" tabIndex={-1}>ASCII by <em>nature.</em></h1>
        <p className="hero-description">Meet thirteen animals drawn in characters. Watch them move, try their controls, or pause to study the details.</p>
        <div className="hero-actions">
          <a className="button primary" href="#catalogue">Browse the animals <span aria-hidden="true">↓</span></a>
          <Link className="button quiet" href="/animals/cuttlefish/" prefetch={false}>Meet the cuttlefish <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <figure className="featured-specimen">
        <div className="specimen-top"><span>01 / Cuttlefish</span><span>Renderer still</span></div>
        {/* This is a real renderer capture. The live animation is mounted only on the study route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${BASE_PATH}/field-guide/cuttlefish.webp`} width={768} height={432}
          alt="An ASCII cuttlefish with a broad patterned mantle and trailing arms, rendered in teal characters." fetchPriority="high" />
        <figcaption><span>Ocean · cephalopod</span><Link href="/animals/cuttlefish/" prefetch={false}>Open featured study <span aria-hidden="true">↗</span></Link></figcaption>
      </figure>
    </section>
    <Catalogue />
    <section id="library" className="library-section" tabIndex={-1} aria-labelledby="library-title"><div><p className="eyebrow">For the curious</p><h2 id="library-title">Take a closer look.</h2><p>Explore the animal APIs and original studios, or keep a standalone cuttlefish study to open offline.</p><p className="small-note">The library is a private review package. Local build instructions are in the repository.</p></div><div className="library-links"><a href={`${REPOSITORY}/blob/main/docs/ANIMAL-APIS.md`}>Read the animal APIs <span aria-hidden="true">↗</span></a><a href={`${BASE_PATH}/cuttlefish.html`} download="cuttlefish.html">Download the cuttlefish study <span aria-hidden="true">↓</span></a><a href={REPOSITORY}>Explore the source <span aria-hidden="true">↗</span></a></div></section>
  </main>;
}
