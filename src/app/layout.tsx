import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pornosticul de Folbal',
  manifest: '/manifest.json',
  icons: { apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0a1712' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="ro">
      <body>
        {session && (
          <>
            <header className="brandbar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo" src="/icon.svg" alt="" width={34} height={34} />
              <span className="brand-name">Pornosticul de Folbal</span>
              <span className="who">{session.name}</span>
            </header>
            <nav>
              <Link href="/">Etapa</Link>
              <Link href="/clasament">Clasament</Link>
              {session.isAdmin && <Link href="/admin">Admin</Link>}
            </nav>
          </>
        )}
        {children}
      </body>
    </html>
  );
}
