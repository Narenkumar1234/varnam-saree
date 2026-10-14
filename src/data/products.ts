import { Product } from '@/types';

export const COLOUR_HEX_MAP: Record<string, string> = {
  Emerald: '#2e6252',
  Rose: '#bb7c8f',
  Indigo: '#323d69',
  Ivory: '#ded2ad',
};

export const products: Product[] = [
  {
    id: 1,
    name: 'Mayil emerald silk saree',
    type: 'Kanchipuram silk',
    collection: 'Silk',
    price: 8490,
    old: 9990,
    pos: '0% 0%',
    colour: 'Emerald',
    tag: 'Bestseller',
    image: '/assets/saree-emerald.webp',
  },
  {
    id: 2,
    name: 'Gulabi rose Banarasi saree',
    type: 'Banarasi silk',
    collection: 'Silk',
    price: 6290,
    pos: '100% 0%',
    colour: 'Rose',
    tag: 'New arrival',
    image: '/assets/saree-rose.webp',
  },
  {
    id: 3,
    name: 'Neelam midnight silk saree',
    type: 'Soft silk',
    collection: 'Festive',
    price: 7490,
    pos: '0% 100%',
    colour: 'Indigo',
    tag: '',
    image: '/assets/saree-indigo.webp',
  },
  {
    id: 4,
    name: 'Malligai ivory cotton saree',
    type: 'Handloom cotton',
    collection: 'Cotton',
    price: 2490,
    pos: '100% 100%',
    colour: 'Ivory',
    tag: 'Everyday favourite',
    image: '/assets/saree-ivory.webp',
  },
  {
    id: 5,
    name: 'Ananya green festive saree',
    type: 'Silk blend',
    collection: 'Festive',
    price: 4590,
    pos: '0% 0%',
    colour: 'Emerald',
    tag: '',
    image: '/assets/saree-emerald.webp',
  },
  {
    id: 6,
    name: 'Roja pink soft silk saree',
    type: 'Soft silk',
    collection: 'Silk',
    price: 5290,
    pos: '100% 0%',
    colour: 'Rose',
    tag: '',
    image: '/assets/saree-rose.webp',
  },
  {
    id: 7,
    name: 'Nila indigo cotton saree',
    type: 'Cotton silk',
    collection: 'Cotton',
    price: 3290,
    pos: '0% 100%',
    colour: 'Indigo',
    tag: 'New arrival',
    image: '/assets/saree-indigo.webp',
  },
  {
    id: 8,
    name: 'Meera gold occasion saree',
    type: 'Cotton silk',
    collection: 'Festive',
    price: 3890,
    pos: '100% 100%',
    colour: 'Ivory',
    tag: '',
    image: '/assets/saree-ivory.webp',
  },
];

export const getProductById = (id: number | string): Product | undefined => {
  return products.find((p) => p.id === Number(id));
};

export const money = (n: number): string => '₹' + n.toLocaleString('en-IN');

export const faqs = [
  [
    'How do I choose the right saree?',
    'Cotton is light and comfortable for everyday wear. Silk brings richness to festive occasions. Use our collection and colour filters to find your style.',
  ],
  [
    'Does the saree include a blouse piece?',
    'Our sample catalogue includes an unstitched blouse piece. Each product screen lists its dimensions and finishing options.',
  ],
  [
    'How do I care for silk sarees?',
    'Dry clean silk sarees and store them in a breathable cotton cover. Refold occasionally and avoid prolonged direct sunlight.',
  ],
  [
    'Can I place a real order?',
    'This website is a demo. Checkout creates a sample order on your browser. Inventory, payments, shipping and customer accounts need to be connected before selling.',
  ],
  [
    'Will the colour look exactly like the photo?',
    'Screen settings and lighting can change how colours appear. These campaign and catalogue images are illustrative generated photography.',
  ],
  [
    'Where can I find delivery and return details?',
    'Visit Shipping & returns for a proposed policy. The business must confirm and approve its final policy before accepting real orders.',
  ],
];

export const articles = [
  {
    id: 1,
    t: 'Finding your first silk saree',
    p: 'A guide to texture, drape, and the colours you return to.',
    body: 'Start with how you want to feel. Soft silk drapes easily; a structured silk holds its form. Choose a colour that complements the blouses you already own, then look closely at the border and pallu. A saree you can imagine wearing in several different ways is often a beautiful first choice.',
  },
  {
    id: 2,
    t: 'A little care goes a long way',
    p: 'Simple rituals to keep your favourite weaves beautiful.',
    body: 'Air your saree after wearing it. Store silk in a breathable cover, away from strong light and moisture. Avoid placing perfume directly on the fabric. Check the care instructions for each material, and use professional dry cleaning for delicate silk and zari.',
  },
  {
    id: 3,
    t: 'The everyday joy of cotton',
    p: 'Light, breathable, and beautifully yours.',
    body: 'Cotton brings quiet comfort to busy days. Pair a simple weave with a contrasting blouse, or keep the palette soft and tonal. A neat pleat and comfortable footwear make it easy to move through the day. Hand wash gently when permitted by the care label, and dry in shade.',
  },
];

export const collectionsData = [
  { name: 'Silk', subtitle: 'Silk, in its finest form', image: '/assets/saree-emerald.webp', query: 'Silk' },
  { name: 'Cotton', subtitle: 'Comfort, beautifully woven', image: '/assets/saree-ivory.webp', query: 'Cotton' },
  { name: 'Festive', subtitle: 'For your brighter moments', image: '/assets/saree-rose.webp', query: 'Festive' },
  { name: 'All', subtitle: 'A colour for every story', image: '/assets/saree-indigo.webp', query: '' },
];

export const VARNAM_CONFIG = {
  whatsappNumber: '919360451710',
  googleClientId: '',
};
