import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('/contact', 'Contact', "Contact Varnam, Gomathipuram, Madurai — phone, WhatsApp and email.");

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
