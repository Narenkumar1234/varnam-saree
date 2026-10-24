import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('/terms', 'Terms & Conditions', "Terms and conditions for buying sarees from Varnam, Madurai.");

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
