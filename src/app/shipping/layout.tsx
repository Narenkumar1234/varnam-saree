import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('/shipping', 'Shipping & Delivery Policy', "Dispatch and delivery timelines for Varnam saree orders shipped within India.");

export default function ShippingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
