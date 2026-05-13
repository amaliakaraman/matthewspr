import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap'
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'KM Socials · Command Center',
  description:
    'Real-time, multi-platform analytics for Kyle Matthews + The Matthews Mentality Podcast.',
  icons: { icon: '/icon.svg' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans text-ink">
        <div className="aurora">
          <div className="blob3" />
        </div>
        <div className="grid-overlay" />
        <div className="noise" />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
