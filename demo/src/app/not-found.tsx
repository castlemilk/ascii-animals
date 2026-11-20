import Link from 'next/link';

export default function NotFound() {
  return <main id="main-content" className="not-found" tabIndex={-1}><p className="eyebrow">Off the map / 404</p><h1 tabIndex={-1}>This creature wandered off.</h1><p>Choose one of the thirteen studies in the field guide.</p><Link className="button primary" href="/#catalogue" prefetch={false}>Back to catalogue</Link></main>;
}
