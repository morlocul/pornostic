import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pronosticuri Liga 1',
  manifest: '/manifest.json',
  icons: { apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0f1b2d' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="ro">
      <body>
        {session && (
          <nav>
            <Link href="/">Etapa</Link>
            <Link href="/clasament">Clasament</Link>
            {session.isAdmin && <Link href="/admin">Admin</Link>}
            <span className="who">{session.name}</span>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}
