import type { Wallet } from '@/shared/contracts/marketplace'

export function testAccountWallets(timestamp: string): Wallet[] {
  const profile = {
    version: 1,
    updatedAt: timestamp,
    displayName: 'Ana',
    profileName: 'ana',
    email: 'ana@kurio.demo',
    secondaryAddress: '',
    referralCode: '',
  }
  return [
    {
      ...profile,
      id: 'ana-wallet',
      label: 'Carteira Ethereum',
      address: `0x${'1'.repeat(40)}`,
      network: 'ethereum',
      provider: 'metamask',
      isDefault: true,
      ens: 'ana.eth',
    },
    {
      ...profile,
      id: 'ana-wallet-polygon',
      label: 'Carteira Polygon',
      address: `0x${'3'.repeat(40)}`,
      network: 'polygon',
      provider: 'coinbase',
      isDefault: false,
      ens: '',
    },
    {
      ...profile,
      id: 'ana-wallet-solana',
      label: 'Carteira Solana',
      address: 'A'.repeat(44),
      network: 'solana',
      provider: 'walletconnect',
      isDefault: false,
      ens: '',
    },
  ]
}
