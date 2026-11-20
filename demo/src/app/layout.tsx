import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer, Header } from '../components/site-shell';
import { RouteFocus } from '../components/route-focus';
import { MotionProvider } from '../components/motion-policy';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ASCII Animals · A living character collection', template: '%s · ASCII Animals' },
  description: 'Thirteen reactive ASCII animal studies. Explore the collection, pause for a still pose, or visit each original studio.',
};
export const viewport: Viewport = { themeColor: '#101713', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <MotionProvider><div className="site-wrap"><Header />{children}<Footer /></div></MotionProvider>
    <RouteFocus />
  </body></html>;
}
