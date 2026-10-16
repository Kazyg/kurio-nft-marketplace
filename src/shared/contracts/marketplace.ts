import { z } from 'zod'

export const ethSchema = z.string().regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/)
export type EthAmount = z.infer<typeof ethSchema>
export type Network = 'ethereum' | 'polygon' | 'solana'
export type Category =
  | 'digital-art'
  | 'photography'
  | 'music'
  | '3d'
  | 'collectibles'
  | 'generative'
  | 'games'
  | 'memberships'
  | 'utility'
export interface Versioned {
  version: number
  updatedAt: string
}
export interface NftEdition extends Versioned {
  id: string
  label: string
  supply: number | null
  available: number
  priceEth: EthAmount
}
export interface Nft extends Versioned {
  technical?: {
    networkDescription?: string
    royaltyBasisPoints?: number
    contractAddress: string
    tokenStandard: 'ERC-1155' | 'Metaplex Token Metadata'
    verification: 'demo-verified' | 'unverified'
  }
  id: string
  name: string
  image: string
  gallery: string[]
  priceEth: EthAmount
  previousPriceEth?: EthAmount
  category: Category
  network: Network
  collection: string
  creator: string
  description: string
  details: string
  tokenId: string
  attributes: string[]
  editions: NftEdition[]
  rating: number
  reviewCount: number
  badge?: string
  featured: boolean
  createdAt: string
}
export const catalogSearchSchema = z.object({
  q: z.string().max(120).catch(''),
  collection: z.string().max(120).optional().catch(undefined),
  category: z
    .enum([
      'digital-art',
      'photography',
      'music',
      '3d',
      'collectibles',
      'generative',
      'games',
      'memberships',
      'utility',
    ])
    .optional()
    .catch(undefined),
  network: z
    .enum(['ethereum', 'polygon', 'solana'])
    .optional()
    .catch(undefined),
  minPrice: ethSchema.optional().catch(undefined),
  maxPrice: ethSchema.optional().catch(undefined),
  sort: z
    .enum(['recent', 'price-asc', 'price-desc', 'popular'])
    .catch('recent'),
  tab: z.enum(['all', 'new', 'trending']).catch('all'),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(24).catch(9),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>
export interface Facet<T extends string> {
  value: T
  label: string
  count: number
}
export interface NftList {
  priceRange: { minEth: EthAmount; maxEth: EthAmount; version: number }
  items: Nft[]
  total: number
  page: number
  pageSize: number
  facets: { categories: Facet<Category>[]; networks: Facet<Network>[] }
}
export interface CatalogContent {
  hero: {
    title: string
    mobileTitle: string
    eyebrow: string
    description: string
    mobileDescription: string
    image: string
    secondaryImage: string
    nftId: string
  }
  featured: { title: string; subtitle: string; image: string; nftId: string }
  promotions: {
    id: string
    title: string
    description: string
    image: string
    category: Category
  }[]
  articles: {
    id: string
    title: string
    description: string
    image: string
    date: string
    readingMinutes: number
  }[]
}
export interface User extends Versioned {
  id: string
  name: string
  email: string
  avatar: string | null
  bio: string
  username: string
  ens: string | null
}
export interface Session {
  user: User | null
  accessToken: string | null
  expiresAt: string | null
}
export interface RegisterInput {
  name: string
  email: string
  password: string
}
export interface LoginInput {
  email: string
  password: string
}
export interface SocialLoginInput {
  provider: 'google' | 'facebook'
}
export interface ProfileInput {
  name?: string
  bio?: string
  username?: string
  email?: string
  ens?: string | null
  avatar?: string | null
  version: number
}
export interface PasswordInput {
  currentPassword: string
  newPassword: string
}
export interface Favorites extends Versioned {
  nftIds: string[]
}
export interface CartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  nft: Nft
}
export interface Cart extends Versioned {
  id: string
  ownerId: string | null
  items: CartItem[]
}
export interface CartItemInput {
  nftId: string
  editionId: string
  quantity: number
}
export interface Coupon {
  code: string
  label: string
  discountBps: number
  expiresAt: string
  minimumEth: EthAmount
}
export interface QuoteInput {
  couponCode?: string
  network?: Network
}
export interface FinancialLine {
  nftId: string
  editionId: string
  name: string
  image: string
  editionLabel: string
  quantity: number
  unitPriceEth: EthAmount
  totalEth: EthAmount
  nftVersion: number
  editionVersion: number
}
export interface FinancialSnapshot {
  lines: FinancialLine[]
  subtotalEth: EthAmount
  discountEth: EthAmount
  feeEth: EthAmount
  totalEth: EthAmount
  coupon: Coupon | null
  currency: 'ETH'
}
export interface Quote extends Versioned {
  network?: Network
  id: string
  cartId: string
  cartVersion: number
  expiresAt: string
  snapshot: FinancialSnapshot
}
export interface Wallet extends Versioned {
  displayName?: string
  profileName?: string
  secondaryAddress?: string
  referralCode?: string
  email?: string
  ens?: string
  id: string
  label: string
  address: string
  network: Network
  provider: 'metamask' | 'walletconnect' | 'coinbase'
  isDefault: boolean
}
export interface WalletInput {
  displayName?: string
  profileName?: string
  secondaryAddress?: string
  referralCode?: string
  email?: string
  ens?: string
  label: string
  address: string
  network: Network
  provider: Wallet['provider']
  isDefault: boolean
}
export type OrderStatus = 'pending' | 'confirmed' | 'declined'
export interface PaymentAttempt {
  id: string
  status: OrderStatus
  createdAt: string
  reason: string | null
}
export interface Receipt {
  id: string
  orderId: string
  issuedAt: string
  snapshot: FinancialSnapshot
}
export interface Collector {
  name: string
  email: string
  note?: string
}
export interface Order extends Versioned {
  wallet: Wallet
  network: Network
  collector: Collector
  transactionReference: string
  resolveAt: string | null
  resolution: 'confirmed' | 'declined' | null
  id: string
  userId: string
  walletId: string
  quoteId: string
  status: OrderStatus
  createdAt: string
  snapshot: FinancialSnapshot
  attempts: PaymentAttempt[]
  receipt: Receipt | null
}
export interface CreateOrderInput {
  collector?: Collector
  network?: Network
  quoteId: string
  walletId: string
}
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'QUOTE_CONFLICT'
  | 'UNAVAILABLE'
  | 'TRANSIENT_ERROR'
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    fields?: Record<string, string>
    requestId: string
    retryable: boolean
  }
}
export interface MockScenario {
  responseDelays: {
    path: string
    method?: string
    delayMs: number
    remaining: number
  }[]
  latencyMs: number
  failures: {
    path: string
    method?: string
    status: 401 | 403 | 409 | 422 | 503
    remaining: number
  }[]
  orderOutcome:
    | OrderStatus
    | 'timeout-after-create'
    | 'timeout-before-create'
    | 'connection-error'
    | 'pending-confirmed'
    | 'pending-declined'
  orderResolutionMs: number
  expiredCoupons: string[]
  sessionTtlMs: number
  quoteTtlMs: number
}

export const endpoints = {
  nfts: '/nfts',
  content: '/catalog/content',
  session: '/auth/session',
  login: '/auth/login',
  social: '/auth/social',
  register: '/auth/register',
  logout: '/auth/logout',
  favorites: '/favorites',
  cart: '/cart',
  cartItems: '/cart/items',
  quotes: '/quotes',
  orders: '/orders',
  profile: '/profile',
  password: '/profile/password',
  wallets: '/wallets',
} as const
