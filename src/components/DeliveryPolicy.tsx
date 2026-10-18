'use client';

import { useStore } from '@/context/store-context';
import { freeDeliveryCopy } from '@/lib/commerce';
import { money } from '@/data/products';

export function DeliveryPolicy({ includeFee = false }: { includeFee?: boolean }) {
  const { commerce: { settings } } = useStore();
  return <span>{freeDeliveryCopy(settings)}{includeFee && settings.standardShippingFee > 0 && settings.freeDeliveryThreshold > 0 ? `; otherwise, a ${money(settings.standardShippingFee)} delivery charge applies` : ''}.</span>;
}
