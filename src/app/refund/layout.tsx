import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('/refund', 'Refund & Replacement Policy', "Varnam's replacement, refund and cancellation policy for saree orders.");

export default function RefundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
