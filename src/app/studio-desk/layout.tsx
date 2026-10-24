import type { Metadata } from 'next';

// Private admin portal: never indexed, and no canonical pointing elsewhere.
export const metadata: Metadata = {
  title: { absolute: 'Studio | Varnam' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  alternates: { canonical: null },
  openGraph: null,
};

export default function StudioDeskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
