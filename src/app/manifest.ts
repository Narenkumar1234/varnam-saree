import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Varnam Sarees',
    short_name: 'Varnam',
    description: "Discover Varnam's collection of silk, cotton and occasion sarees.",
    start_url: '/',
    display: 'standalone',
    background_color: '#fcfaf6',
    theme_color: '#392535',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
