import Link from 'next/link';
import { REPOSITORY, type Animal } from '../lib/catalogue';

export function Header() {
  return <header className="site-header">
    <Link className="brand" href="/" prefetch={false} aria-label="ASCII Animals home">
      <span className="brand-mark" aria-hidden="true">{'{a}'}</span><span>ascii animals<span className="brand-dot">.</span></span>
    </Link>
    <nav className="main-nav" aria-label="Main navigation">
      <Link href="/#catalogue" prefetch={false}>Catalogue</Link>
      <Link href="/#library" prefetch={false}>Library</Link>
      <a href={REPOSITORY}>Source <span aria-hidden="true">↗</span></a>
    </nav>
  </header>;
}

export function Breadcrumbs({ animal }: { animal?: Animal }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li><Link href="/" prefetch={false}>ASCII Animals</Link></li>
      <li>{animal ? <Link href="/#catalogue" prefetch={false}>Catalogue</Link> : <span aria-current="page">Catalogue</span>}</li>
      {animal && <li><span aria-current="page">{animal.name}</span></li>}
    </ol>
  </nav>;
}

export function Footer() {
  return <footer className="site-footer">
    <p><span className="brand-mark" aria-hidden="true">{'{a}'}</span> A living character collection.</p>
    <Link href="/#catalogue" prefetch={false}>Back to the field guide <span aria-hidden="true">↑</span></Link>
  </footer>;
}
