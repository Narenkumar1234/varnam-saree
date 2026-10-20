import { getCustomerFirebase } from '@/lib/firebase';

/** Bearer header for the current Google session, or empty when signed out / unconfigured. */
export async function customerAuthHeaders(): Promise<Record<string, string>> {
  try {
    const user = getCustomerFirebase().auth.currentUser;
    if (!user) return {};
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  } catch {
    return {};
  }
}
