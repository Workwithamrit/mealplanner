import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import './globals.css';
import SeedProvider from '@/components/SeedProvider';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'SwYam Meal Planner',
  description: 'Plan balanced Veg / Non-Veg weeks, sync with OvO.',
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${plusJakarta.variable} ${inter.variable}`}>
      <body className="h-full antialiased">
        <SeedProvider>{children}</SeedProvider>
      </body>
    </html>
  );
}
