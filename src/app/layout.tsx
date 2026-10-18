import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/store-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingSocials } from '@/components/FloatingSocials';
import { Toast } from '@/components/Toast';
import { PageTransitionLoader } from '@/components/PageTransitionLoader';

export const metadata: Metadata = {
  title: 'Varnam | Sarees, woven with stories',
  description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
  openGraph: {
    title: 'Varnam | Sarees, woven with stories',
    description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
    images: ['/assets/varnam-logo.png'],
  },
  icons: {
    icon: '/assets/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <StoreProvider>
          <PageTransitionLoader />
          <Header />
          <main id="app">{children}</main>
          <Footer />
          <FloatingSocials />
          <Toast />
        </StoreProvider>
      </body>
    </html>
  );
}
