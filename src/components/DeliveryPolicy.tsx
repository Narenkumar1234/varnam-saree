'use client';

import { useStore } from '@/context/store-context';
import { deliveryPolicyText, type DeliveryPolicyOptions } from '@/lib/delivery-policy';

export function DeliveryPolicy({ includeFee = false, embedded = false }: DeliveryPolicyOptions) {
  const { commerce: { settings } } = useStore();
  return <span>{deliveryPolicyText(settings, { includeFee, embedded })}</span>;
}
