export const auditConfig = {
  pages: [
    { name: 'home', path: '/' },
    { name: 'details', path: '/nfts/emerald-ape' },
  ],
  profiles: ['desktop', 'mobile'],
  thresholds: {
    performance: 90,
    accessibility: 95,
    'best-practices': 95,
    seo: 90,
  },
} as const
