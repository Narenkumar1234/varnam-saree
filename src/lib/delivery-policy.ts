import { freeDeliveryCopy, type SiteSettings } from '@/lib/commerce';
import { money } from '@/data/products';

export function deliveryPolicyText(settings: SiteSettings, { includeFee = false, embedded = false }: { includeFee?: boolean; embedded?: boolean } = {}): string {
  let text = freeDeliveryCopy(settings);
  if (includeFee && settings.standardShippingFee > 0 && settings.freeDeliveryThreshold > 0) text += `; otherwise, a ${money(settings.standardShippingFee)} delivery charge applies`;
  return embedded ? text.charAt(0).toLowerCase() + text.slice(1) : `${text}.`;
}
