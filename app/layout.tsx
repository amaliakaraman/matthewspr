import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

// Inter is retained only for the print/recap surface; Satoshi (loaded via
// @font-face in globals.css) is the app-wide UI face.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Matthews PR · Command Center',
  description:
    'Podcast booking, outreach, and social analytics for Kyle Matthews + The Matthews Mentality Podcast.',
  icons: { icon: '/icon.svg' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${inter.variable}`}>
      <body className="min-h-screen bg-white font-sans text-mx-title antialiased">
        {children}
      </body>
    </html>
  );
}
