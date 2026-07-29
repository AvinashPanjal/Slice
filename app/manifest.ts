import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LendWise - Personal Ledger',
    short_name: 'LendWise',
    description: 'Smart EMI & Loan Management Ledger System',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1c30',
    theme_color: '#0b1c30',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
