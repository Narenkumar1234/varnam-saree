'use client';

import { useStore } from '@/context/store-context';
import { deliveryPolicyText } from '@/lib/delivery-policy';

export function DeliveryPolicy({ includeFee = false, embedded = false }: { includeFee?: boolean; embedded?: boolean }) {
  const { commerce: { settings } } = useStore();
  return <span>{deliveryPolicyText(settings, { includeFee, embedded })}</span>;
}
