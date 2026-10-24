import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('/privacy', 'Privacy Policy', "How Varnam collects, uses and protects your personal information.");

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
