import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/context/store-context';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { FloatingSocials } from '@/components/FloatingSocials';
import { Toast } from '@/components/Toast';
import { PageTransitionLoader } from '@/components/PageTransitionLoader';
import { getCatalogue } from '@/lib/catalogue-server';
import { getCommerce } from '@/lib/commerce-server';
import { WhatsAppFallback } from '@/components/WhatsAppFallback';
import { getSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: 'Varnam | Sarees, woven with stories',
    template: '%s | Varnam',
  },
  description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
  alternates: {
    canonical: getSiteUrl().href,
  },
  openGraph: {
    title: 'Varnam | Sarees, woven with stories',
    description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
    url: getSiteUrl().href,
    siteName: 'Varnam',
    type: 'website',
    images: [new URL('/assets/varnam-logo.png', getSiteUrl()).href],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Varnam | Sarees, woven with stories',
    description: "Discover Varnam's collection of silk, cotton and occasion sarees. A thoughtfully designed saree shopping experience.",
    images: [new URL('/assets/varnam-logo.png', getSiteUrl()).href],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [catalogue, commerce] = await Promise.all([getCatalogue(), getCommerce()]);
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
        <StoreProvider initialProducts={catalogue.products} initialCommerce={commerce}>
          <PageTransitionLoader />
          <Header />
          <main id="app">{children}</main>
          <Footer />
          <FloatingSocials />
          <Toast />
          <WhatsAppFallback />
        </StoreProvider>
      </body>
    </html>
  );
}
