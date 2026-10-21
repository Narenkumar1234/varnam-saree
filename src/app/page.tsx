import { HomePage } from '@/components/HomePage';
import { getPublicReviews } from '@/lib/reviews-server';

// Server component: the reviews section is read fresh per request (like the commerce
// settings in the root layout) and server-rendered, so it never shifts the page.
export default async function Page() {
  return <HomePage reviews={await getPublicReviews()} />;
}
