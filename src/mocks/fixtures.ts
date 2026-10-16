import type {
  CatalogContent,
  Category,
  Network,
  Nft,
} from '@/shared/contracts/marketplace'
const names = [
  'Emerald Ape',
  'Sage Nomad',
  'Neon Vessel',
  'Cosmic Bloom',
  'Violet Nomad',
  'Ivory Baron',
  'Golden Beat',
  'Golden Signal',
]
const ids = names.map((name) => name.toLowerCase().replaceAll(' ', '-'))
export const socialIdentities = {
  google: {
    id: 'demo-social-google',
    name: 'Colecionador Google',
    email: 'google@social.kurio.demo',
    username: 'google_demo',
  },
  facebook: {
    id: 'demo-social-facebook',
    name: 'Colecionador Facebook',
    email: 'facebook@social.kurio.demo',
    username: 'facebook_demo',
  },
} as const
export const categories: Category[] = [
  'digital-art',
  'photography',
  'music',
  '3d',
  'collectibles',
  'generative',
  'games',
  'memberships',
  'utility',
]
export const networks: Network[] = ['ethereum', 'polygon', 'solana']
export const categoryLabels = [
  'Arte digital',
  'Fotografia',
  'Música',
  '3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
]
export const legacyNftDescription =
  'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'
export const legacyNftDetails =
  'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.'
export function createNfts(): Nft[] {
  return Array.from({ length: 36 }, (_, i) => {
    const assetId = ids[i % 8]!
    const id = i < 8 ? assetId : `${assetId}-${Math.floor(i / 8) + 1}`
    const priceEth =
      i < 8
        ? ['1.19', '1.69', '1.99', '1.29', '1.39', '1.79', '0.99', '0.39'][i]!
        : [
            '0.125',
            '0.25',
            '0.3',
            '0.75',
            '1.2',
            '2.5',
            '4',
            '0.000000000000000001',
          ][i % 8]!
    const timestamp = new Date(Date.UTC(2026, 9, 15 - i)).toISOString()
    const version = { version: 1, updatedAt: timestamp }
    const network = networks[i % 3]!
    const name = `${names[i % 8]} #${i < 8 ? ['042', '009', '552', '118', '314', '088', '207', '160'][i] : String(200 + i)}`
    return {
      ...version,
      id,
      name,
      image: `/assets/nfts/${assetId}.png`,
      gallery: [`/assets/nfts/${assetId}.png`],
      priceEth,
      previousPriceEth: i === 2 ? '2.29' : undefined,
      category: categories[i % categories.length]!,
      network,
      technical: {
        networkDescription: {
          ethereum: 'Ethereum — rede de contratos inteligentes.',
          polygon: 'Polygon — rede EVM compatível com Ethereum.',
          solana: 'Solana — rede com metadados de tokens Metaplex.',
        }[network],
        royaltyBasisPoints: [500, 250, 750, 0][i % 4]!,
        contractAddress:
          network === 'solana'
            ? Array.from(
                { length: 44 },
                (_, position) =>
                  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[
                    (i + position * 7) % 58
                  ],
              ).join('')
            : `0x${(0x7a420000000000000000000000000000000019e8n + BigInt(i)).toString(16).padStart(40, '0')}`,
        tokenStandard:
          network === 'solana' ? 'Metaplex Token Metadata' : 'ERC-1155',
        verification: i % 2 === 0 ? 'demo-verified' : 'unverified',
      },
      collection:
        i < 8
          ? 'Kurio Apes'
          : ['Kurio Editions', 'Future Forms', 'Digital Nature'][i % 3]!,
      creator:
        i === 0
          ? 'Nova Sato'
          : ['Luna Studio', 'Alex Morgan', 'Kai Nakamura'][i % 3]!,
      description:
        'Um colecionável digital finalizado à mão, com arte desbloqueável e acesso para colecionadores.',
      details: `${name} explora identidade, movimento e luz em um mundo digital sem fronteiras. Explore os atributos e as referências técnicas desta coleção.`,
      tokenId: i === 0 ? '#042' : String(1000 + i),
      attributes:
        i === 0
          ? ['Óculos', 'Esmeralda', 'Raro']
          : ['Arte original', 'Alta resolução', 'Colecionável digital'],
      editions: [
        {
          ...version,
          id: `${id}-standard`,
          label: '1/50',
          supply: 50,
          available: i === 0 ? 50 : i === 7 ? 0 : 12,
          priceEth,
        },
        {
          ...version,
          id: `${id}-limited`,
          label: '1/10',
          supply: 10,
          available: 3,
          priceEth: '2.75',
        },
        {
          ...version,
          id: `${id}-unique`,
          label: '1/1',
          supply: 1,
          available: 1,
          priceEth: '4.5',
        },
        {
          ...version,
          id: `${id}-open`,
          label: 'ABERTA',
          supply: null,
          available: 100,
          priceEth: '0.1',
        },
      ],
      rating: i === 0 ? 4.8 : 4 + (i % 10) / 10,
      reviewCount: i === 0 ? 19 : 10 + i * 7,
      badge:
        i < 8
          ? i === 2
            ? 'RARO'
            : undefined
          : i % 3 === 0
            ? 'NOVO'
            : undefined,
      featured: i < 8,
      createdAt: timestamp,
    }
  })
}
export const catalogContent: CatalogContent = {
  hero: {
    title: 'SEJA DONO DO FUTURO\nDA ARTE DIGITAL',
    mobileTitle: 'SEJA DONO DA CULTURA DIGITAL',
    eyebrow: 'Bem-vindo à Kurio',
    description:
      'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    mobileDescription: 'Descubra NFTs selecionados de criadores do mundo todo.',
    image: '/assets/nfts/emerald-ape.png',
    secondaryImage: '/assets/nfts/sage-nomad.png',
    nftId: 'emerald-ape',
  },
  featured: {
    title: 'NFT EM DESTAQUE',
    subtitle: 'OFERTA LIMITADA',
    image: '/assets/nfts/cosmic-bloom.png',
    nftId: 'cosmic-bloom',
  },
  promotions: [
    {
      id: 'art',
      title: 'Lançamentos gênesis de edição limitada',
      description:
        'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
      image: '/assets/nfts/emerald-ape.png',
      category: 'digital-art',
    },
    {
      id: 'music',
      title: 'Arte digital selecionada e muito mais',
      description:
        'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
      image: '/assets/nfts/neon-vessel.png',
      category: 'music',
    },
  ],
  articles: [
    {
      id: 'collecting',
      title: 'Como funciona a propriedade de NFTs',
      description:
        'Aprenda a colecionar, negociar e verificar ativos digitais.',
      image: '/assets/nfts/neon-vessel.png',
      date: '2026-09-12',
      readingMinutes: 6,
    },
    {
      id: 'creators',
      title: '10 artistas digitais para acompanhar',
      description: 'Conheça criadores que moldam a cultura digital.',
      image: '/assets/nfts/emerald-ape.png',
      date: '2026-09-13',
      readingMinutes: 2,
    },
    {
      id: 'rarity',
      title: 'Raridade, atributos e procedência',
      description:
        'Entenda raridade, procedência, direitos autorais e utilidade.',
      image: '/assets/nfts/sage-nomad.png',
      date: '2026-09-15',
      readingMinutes: 3,
    },
    {
      id: 'wallet-security',
      title: 'Como proteger sua carteira',
      description: 'Proteja sua carteira, seus ativos e sua identidade.',
      image: '/assets/nfts/golden-beat.png',
      date: '2026-09-15',
      readingMinutes: 2,
    },
  ],
}
