import type { Metadata } from 'next';
import { Space_Mono, Syne, DM_Sans } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LifeReplay – AI Communication Coach',
  description: 'Real-time AI-powered communication and performance coaching platform',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'LifeReplay',
    description: 'Master your communication with real-time AI coaching',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${dmSans.variable} ${spaceMono.variable} font-body bg-void text-text-primary antialiased`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#14141f',
              color: '#f0f0ff',
              border: '1px solid #1e1e2e',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#00c896', secondary: '#080810' },
            },
            error: {
              iconTheme: { primary: '#f43f5e', secondary: '#080810' },
            },
          }}
        />
      </body>
    </html>
  );
}
