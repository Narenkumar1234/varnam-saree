/**
 * Confirmed business identity used on the policy pages, contact page and footer.
 * Keep this the single source of truth so the name shown to customers (and to the
 * payment gateway during website verification) stays consistent everywhere.
 */
export const BUSINESS = {
  name: 'Varnam',
  addressName: 'Varnam Sarees',
  grievanceOfficer: 'Kavitha',
  addressLines: ['6th Main Road, Gomathipuram', 'Madurai, Tamil Nadu 625020', 'India'],
  phoneDisplay: '+91 93604 51710',
  phoneHref: 'tel:+919360451710',
  whatsappHref: 'https://wa.me/919360451710',
  email: 'varnamsarees52@gmail.com',
  dispatchDays: 2,
  deliveryWindow: '5–7',
  replacementWindowDays: 5,
  shopHours: '10:00 AM to 8:30 PM',
} as const;

export const BUSINESS_ADDRESS_ONE_LINE = [BUSINESS.addressName, ...BUSINESS.addressLines].join(', ');

export const POLICY_LINKS = [
  { href: '/terms', label: 'Terms & conditions' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/refund', label: 'Refunds & replacement' },
  { href: '/shipping', label: 'Shipping & delivery' },
  { href: '/contact', label: 'Contact us' },
] as const;
