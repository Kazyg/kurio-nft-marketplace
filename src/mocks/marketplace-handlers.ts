import { http, HttpResponse, delay } from 'msw'
import { catalogSearchSchema } from '@/shared/contracts/marketplace'
import type {
  ApiErrorCode,
  Cart,
  Coupon,
  CreateOrderInput,
  FinancialSnapshot,
  MockScenario,
  Order,
  User,
  WalletInput,
} from '@/shared/contracts/marketplace'
import { basisPoints, fromWei, toWei } from '@/shared/contracts/money'
import {
  catalogContent,
  categories,
  categoryLabels,
  networks,
  socialIdentities,
} from './fixtures'
import {
  now,
  mockRequestLatency,
  passwordHash,
  reset,
  resolveOrder,
  touch,
  transaction,
  version,
} from './repository'
import type { State } from './repository'
class DomainError extends Error {
  commit = false
  responseDelayMs = 0
  status: number
  code: ApiErrorCode
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
const fail = (
  status: number,
  code: ApiErrorCode,
  message: string,
  commit = false,
  responseDelayMs = 0,
): never => {
  const error = new DomainError(status, code, message)
  error.commit = commit
  error.responseDelayMs = responseDelayMs
  throw error
}
const invalid = (message: string): never =>
  fail(422, 'VALIDATION_ERROR', message)
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('Expected an object')
  return value as Record<string, unknown>
}
function text(value: unknown, label: string, min = 1, max = 200): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max
  )
    return invalid(`Invalid ${label}`)
  return value.trim()
}
function integer(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10000
  )
    return invalid('Invalid quantity')
  return value
}
function actor(
  state: State,
  request: Request,
  required = false,
): User | undefined {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token)
    return required
      ? fail(401, 'UNAUTHENTICATED', 'Sign in to continue')
      : undefined
  const session = state.sessions[token]
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (token) delete state.sessions[token]
    return fail(401, 'UNAUTHENTICATED', 'Session expired')
  }
  return state.users.find((u) => u.id === session.userId)!
}
function cart(state: State, request: Request): Cart {
  const user = actor(state, request)
  const guest = request.headers.get('X-Guest-Id')
  if (!user && (!guest || !/^[\w-]{1,100}$/.test(guest)))
    return invalid('X-Guest-Id is required')
  const key = user ? `user:${user.id}` : `guest:${guest}`
  const target = (state.carts[key] ??= {
    ...version(),
    id: key,
    ownerId: user?.id ?? null,
    items: [],
  })
  for (const item of target.items)
    item.nft = state.nfts.find((n) => n.id === item.nftId) ?? item.nft
  return target
}
function available(
  state: State,
  nftId: string,
  editionId: string,
  quantity: number,
) {
  const nft =
    state.nfts.find((n) => n.id === nftId) ??
    fail(404, 'NOT_FOUND', 'NFT not found')
  const edition =
    nft.editions.find((e) => e.id === editionId) ??
    invalid('Edition does not belong to this NFT')
  if (quantity > edition.available)
    fail(409, 'UNAVAILABLE', 'Requested quantity is not available')
  return { nft, edition }
}
function add(state: State, target: Cart, input: Record<string, unknown>) {
  const nftId = text(input.nftId, 'NFT'),
    editionId = text(input.editionId, 'edition'),
    quantity = integer(input.quantity)
  const existing = target.items.find(
    (i) => i.nftId === nftId && i.editionId === editionId,
  )
  const total = quantity + (existing?.quantity ?? 0)
  const { nft } = available(state, nftId, editionId, total)
  if (existing) {
    existing.quantity = total
    existing.nft = nft
  } else
    target.items.push({
      id: crypto.randomUUID(),
      nftId,
      editionId,
      quantity,
      nft,
    })
  touch(target)
}
function session(state: State, user: User, request: Request) {
  const guest = request.headers.get('X-Guest-Id'),
    source = guest ? state.carts[`guest:${guest}`] : undefined
  const destination = (state.carts[`user:${user.id}`] ??= {
    ...version(),
    id: `user:${user.id}`,
    ownerId: user.id,
    items: [],
  })
  if (source) {
    for (const item of source.items) {
      const existing = destination.items.find(
        (i) => i.editionId === item.editionId,
      )
      const stock = available(state, item.nftId, item.editionId, 0).edition
        .available
      const quantity = Math.min(
        stock,
        (existing?.quantity ?? 0) + item.quantity,
      )
      if (existing) existing.quantity = quantity
      else if (quantity) destination.items.push({ ...item, quantity })
    }
    destination.items = destination.items.filter((i) => i.quantity > 0)
    touch(destination)
    delete state.carts[`guest:${guest}`]
  }
  const accessToken = crypto.randomUUID(),
    expiresAt = new Date(Date.now() + state.scenario.sessionTtlMs).toISOString()
  state.sessions[accessToken] = { userId: user.id, expiresAt }
  return { user, accessToken, expiresAt }
}
const couponDefinitions: Coupon[] = [
  {
    code: 'KURIO10',
    label: '10% de desconto',
    discountBps: 1000,
    expiresAt: '2099-01-01T00:00:00.000Z',
    minimumEth: '0.1',
  },
  {
    code: 'EXPIRED',
    label: 'Cupom expirado',
    discountBps: 2000,
    expiresAt: '2020-01-01T00:00:00.000Z',
    minimumEth: '0',
  },
]
function snapshot(
  state: State,
  target: Cart,
  couponCode?: string,
  network?: WalletInput['network'],
): FinancialSnapshot {
  const items = network
    ? target.items.filter(
        (item) =>
          state.nfts.find((nft) => nft.id === item.nftId)?.network === network,
      )
    : target.items
  if (!items.length) return invalid('Cart has no items for this network')
  const lines = items.map((item) => {
    const { nft, edition } = available(
      state,
      item.nftId,
      item.editionId,
      item.quantity,
    )
    return {
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      image: nft.image,
      editionLabel: edition.label,
      quantity: item.quantity,
      unitPriceEth: edition.priceEth,
      totalEth: fromWei(toWei(edition.priceEth) * BigInt(item.quantity)),
      nftVersion: nft.version,
      editionVersion: edition.version,
    }
  })
  const subtotal = lines.reduce((sum, line) => sum + toWei(line.totalEth), 0n)
  const coupon = couponCode
    ? (couponDefinitions.find((c) => c.code === couponCode.toUpperCase()) ??
      invalid('Unknown coupon'))
    : null
  if (
    coupon &&
    (Date.parse(coupon.expiresAt) <= Date.now() ||
      state.scenario.expiredCoupons.includes(coupon.code) ||
      subtotal < toWei(coupon.minimumEth))
  )
    return invalid('Coupon expired or minimum not met')
  const discount = basisPoints(subtotal, coupon?.discountBps ?? 0),
    fee = basisPoints(subtotal - discount, 250)
  return {
    lines,
    subtotalEth: fromWei(subtotal),
    discountEth: fromWei(discount),
    feeEth: fromWei(fee),
    totalEth: fromWei(subtotal - discount + fee),
    coupon,
    currency: 'ETH',
  }
}
function walletInput(input: Record<string, unknown>): WalletInput {
  const network = text(input.network, 'network') as WalletInput['network'],
    provider = text(input.provider, 'provider') as WalletInput['provider']
  if (
    !networks.includes(network) ||
    !['metamask', 'walletconnect', 'coinbase'].includes(provider)
  )
    return invalid('Invalid wallet network or provider')
  const address = text(input.address, 'address', 20, 100)
  if (network !== 'solana' && !/^0x[a-fA-F0-9]{40}$/.test(address))
    return invalid('Invalid wallet address')
  if (network === 'solana' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
    return invalid('Invalid wallet address')
  if (typeof input.isDefault !== 'boolean')
    return invalid('Invalid default wallet')
  const metadata: Partial<WalletInput> = {}
  for (const field of [
    'displayName',
    'profileName',
    'secondaryAddress',
    'referralCode',
    'email',
    'ens',
  ] as const) {
    if (input[field] === undefined) continue
    const value = text(input[field], field, 0, field === 'email' ? 200 : 100)
    if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return invalid('Invalid wallet email')
    if (field === 'ens' && value && !/^[a-z0-9][a-z0-9.-]*\.eth$/i.test(value))
      return invalid('Invalid wallet ENS')
    metadata[field] = value
  }
  return {
    ...metadata,
    label: text(input.label, 'label', 1, 80),
    address,
    network,
    provider,
    isDefault: input.isDefault,
  }
}
async function route(
  state: State,
  request: Request,
  path: string,
): Promise<unknown> {
  const method = request.method,
    url = new URL(request.url)
  const input = ['POST', 'PATCH', 'PUT'].includes(method)
    ? object(await request.json().catch(() => ({})))
    : {}
  if (path === '/__mock/reset' && method === 'POST') {
    await reset(state)
    return { ok: true }
  }
  if (path === '/__mock/scenario') {
    if (method === 'PATCH') {
      const next = { ...state.scenario, ...input } as MockScenario
      if (
        ![
          next.latencyMs,
          next.sessionTtlMs,
          next.quoteTtlMs,
          next.orderResolutionMs,
        ].every((n) => Number.isInteger(n) && n >= 0 && n <= 86400000) ||
        ![
          'pending',
          'confirmed',
          'declined',
          'timeout-after-create',
          'timeout-before-create',
          'connection-error',
          'pending-confirmed',
          'pending-declined',
        ].includes(next.orderOutcome) ||
        !Array.isArray(next.responseDelays) ||
        !next.responseDelays.every(
          (entry) =>
            typeof entry.path === 'string' &&
            (entry.method === undefined || typeof entry.method === 'string') &&
            Number.isInteger(entry.delayMs) &&
            entry.delayMs >= 0 &&
            entry.delayMs <= 60000 &&
            Number.isInteger(entry.remaining) &&
            entry.remaining >= 0,
        ) ||
        !Array.isArray(next.expiredCoupons) ||
        !next.expiredCoupons.every((c) => typeof c === 'string') ||
        !Array.isArray(next.failures) ||
        !next.failures.every(
          (f) =>
            typeof f.path === 'string' &&
            [401, 403, 409, 422, 503].includes(f.status) &&
            Number.isInteger(f.remaining) &&
            f.remaining >= 0,
        )
      )
        return invalid('Invalid scenario')
      state.scenario = next
    }
    return state.scenario
  }
  if (path.startsWith('/__mock/nfts/') && method === 'PATCH') {
    const nft =
      state.nfts.find((n) => n.id === path.slice(13)) ??
      fail(404, 'NOT_FOUND', 'NFT not found')
    const edition =
      nft.editions.find(
        (e) => e.id === (input.editionId ?? nft.editions[0]?.id),
      ) ?? invalid('Edition not found')
    if (input.priceEth !== undefined) {
      const price = text(input.priceEth, 'price')
      try {
        toWei(price)
      } catch {
        return invalid('Invalid price')
      }
      edition.priceEth = price
      if (edition.id === nft.editions[0]?.id) nft.priceEth = price
    }
    if (input.available !== undefined) {
      if (
        !Number.isInteger(input.available) ||
        typeof input.available !== 'number' ||
        input.available < 0 ||
        (edition.supply !== null && input.available > edition.supply)
      )
        return invalid('Invalid availability')
      edition.available = input.available
    }
    touch(edition)
    touch(nft)
    return nft
  }
  const failure = state.scenario.failures.find(
    (f) =>
      f.remaining > 0 &&
      (f.path === path ||
        (f.path.endsWith('*') && path.startsWith(f.path.slice(0, -1)))) &&
      (!f.method || f.method.toUpperCase() === method),
  )
  if (failure) {
    failure.remaining--
    fail(
      failure.status,
      (
        {
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          409: 'CONFLICT',
          422: 'VALIDATION_ERROR',
          503: 'TRANSIENT_ERROR',
        } as const
      )[failure.status],
      'Configured mock failure',
      true,
    )
  }
  if (path === '/catalog/content' && method === 'GET') return catalogContent
  if (path === '/nfts' && method === 'GET') {
    for (const key of ['minPrice', 'maxPrice']) {
      const amount = url.searchParams.get(key)
      if (amount !== null) {
        try {
          toWei(amount)
        } catch {
          return invalid('Invalid price range')
        }
      }
    }
    const min = url.searchParams.get('minPrice'),
      max = url.searchParams.get('maxPrice')
    if (min && max && toWei(min) > toWei(max))
      return invalid('Invalid price range')
    const search = catalogSearchSchema.parse(
      Object.fromEntries(url.searchParams),
    )
    let items = state.nfts.filter(
      (n) =>
        (!search.q ||
          `${n.name} ${n.collection} ${n.creator}`
            .toLowerCase()
            .includes(search.q.toLowerCase())) &&
        (!search.category || n.category === search.category) &&
        (!search.collection || n.collection === search.collection) &&
        (!search.network || n.network === search.network) &&
        (!search.minPrice || toWei(n.priceEth) >= toWei(search.minPrice)) &&
        (!search.maxPrice || toWei(n.priceEth) <= toWei(search.maxPrice)) &&
        (search.tab !== 'new' || n.createdAt >= '2026-10-01') &&
        (search.tab !== 'trending' || n.reviewCount >= 100),
    )
    items = items.toSorted((a, b) =>
      search.sort === 'popular'
        ? b.reviewCount - a.reviewCount
        : search.sort === 'recent'
          ? b.createdAt.localeCompare(a.createdAt)
          : (toWei(a.priceEth) < toWei(b.priceEth)
              ? -1
              : toWei(a.priceEth) > toWei(b.priceEth)
                ? 1
                : a.id.localeCompare(b.id)) *
            (search.sort === 'price-desc' ? -1 : 1),
    )
    return {
      items: items.slice(
        (search.page - 1) * search.pageSize,
        search.page * search.pageSize,
      ),
      total: items.length,
      priceRange: {
        minEth: '0',
        version: state.nfts.reduce((sum, nft) => sum + nft.version, 0),
        maxEth: fromWei(
          state.nfts.reduce((highest, nft) => {
            const price = toWei(nft.priceEth)
            return price > highest ? price : highest
          }, 0n),
        ),
      },
      page: search.page,
      pageSize: search.pageSize,
      facets: {
        categories: categories.map((value, i) => ({
          value,
          label: categoryLabels[i],
          count: state.nfts.filter((n) => n.category === value).length,
        })),
        networks: networks.map((value) => ({
          value,
          label: value[0]!.toUpperCase() + value.slice(1),
          count: state.nfts.filter((n) => n.network === value).length,
        })),
      },
    }
  }
  if (path.startsWith('/nfts/') && method === 'GET')
    return (
      state.nfts.find((n) => n.id === path.slice(6)) ??
      fail(404, 'NOT_FOUND', 'NFT not found')
    )
  if (path === '/auth/register' && method === 'POST') {
    const name = text(input.name, 'name', 2, 80),
      email = text(input.email, 'email', 3).toLowerCase(),
      password = text(input.password, 'password', 8, 128)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return invalid('Invalid email')
    if (state.users.some((u) => u.email === email))
      return fail(409, 'CONFLICT', 'Email already registered')
    const user = {
      ...version(),
      id: crypto.randomUUID(),
      name,
      email,
      avatar: null,
      bio: '',
      username: `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      ens: null,
    }
    state.users.push(user)
    state.credentials[user.id] = await passwordHash(password)
    return session(state, user, request)
  }
  if (path === '/auth/social' && method === 'POST') {
    const provider = input.provider
    if (provider !== 'google' && provider !== 'facebook')
      return invalid('Invalid social provider')
    const identity = socialIdentities[provider]
    let user = state.users.find((entry) => entry.id === identity.id)
    if (!user) {
      let suffix = 0
      let email: string = identity.email
      let username: string = identity.username
      while (
        state.users.some(
          (entry) =>
            entry.email.toLowerCase() === email.toLowerCase() ||
            entry.username === username,
        )
      ) {
        suffix++
        email = `${provider}${suffix}@social.kurio.demo`
        username = `${identity.username}_${suffix}`
      }
      user = {
        ...version(),
        ...identity,
        email,
        username,
        avatar: null,
        bio: '',
        ens: null,
      }
      state.users.push(user)
      state.credentials[user.id] = await passwordHash(crypto.randomUUID())
      state.wallets[user.id] = []
    }
    return session(state, user, request)
  }
  if (path === '/auth/login' && method === 'POST') {
    const email = text(input.email, 'email').toLowerCase(),
      password = text(input.password, 'password', 1, 128),
      user = state.users.find((u) => u.email === email)
    if (!user) return fail(401, 'UNAUTHENTICATED', 'Invalid credentials')
    const credential = state.credentials[user.id]!
    if (
      (await passwordHash(password, credential.salt)).hash !== credential.hash
    )
      return fail(401, 'UNAUTHENTICATED', 'Invalid credentials')
    return session(state, user, request)
  }
  if (path === '/auth/session' && method === 'GET') {
    const user = actor(state, request)
    const token = request.headers.get('Authorization')?.slice(7)
    return {
      user: user ?? null,
      accessToken: token ?? null,
      expiresAt: token ? (state.sessions[token]?.expiresAt ?? null) : null,
    }
  }
  if (path === '/auth/logout' && method === 'POST') {
    const token = request.headers.get('Authorization')?.slice(7)
    if (token) delete state.sessions[token]
    return undefined
  }
  if (path === '/cart' && method === 'GET') return cart(state, request)
  if (path === '/cart/items' && method === 'POST') {
    const target = cart(state, request)
    add(state, target, input)
    return target
  }
  if (path.startsWith('/cart/items/')) {
    const target = cart(state, request),
      item =
        target.items.find((i) => i.id === path.slice(12)) ??
        fail(404, 'NOT_FOUND', 'Cart item not found')
    if (method === 'PATCH') {
      const quantity = integer(input.quantity)
      available(state, item.nftId, item.editionId, quantity)
      item.quantity = quantity
    } else if (method === 'DELETE')
      target.items = target.items.filter((i) => i.id !== item.id)
    else return fail(404, 'NOT_FOUND', 'Endpoint not found')
    touch(target)
    return target
  }
  if (path === '/quotes' && method === 'POST') {
    const network = input.network as WalletInput['network'] | undefined
    if (network !== undefined && !networks.includes(network))
      return invalid('Invalid quote network')
    const target = cart(state, request),
      financial = snapshot(
        state,
        target,
        input.couponCode === undefined
          ? undefined
          : text(input.couponCode, 'coupon'),
        network,
      )
    const quote = {
      ...version(),
      ...(network ? { network } : {}),
      id: crypto.randomUUID(),
      cartId: target.id,
      cartVersion: target.version,
      expiresAt: new Date(Date.now() + state.scenario.quoteTtlMs).toISOString(),
      snapshot: financial,
    }
    state.quotes[quote.id] = quote
    return quote
  }
  const user = actor(state, request, true)!
  if (path === '/favorites' || path.startsWith('/favorites/')) {
    if (
      path === '/favorites'
        ? method !== 'GET'
        : !['PUT', 'DELETE'].includes(method)
    )
      return fail(404, 'NOT_FOUND', 'Endpoint not found')
    const favorites = (state.favorites[user.id] ??= {
      ...version(),
      nftIds: [],
    })
    if (path !== '/favorites') {
      const id = path.slice(11)
      if (!state.nfts.some((n) => n.id === id))
        return fail(404, 'NOT_FOUND', 'NFT not found')
      if (method === 'PUT' && !favorites.nftIds.includes(id)) {
        favorites.nftIds.push(id)
        touch(favorites)
      } else if (method === 'DELETE') {
        favorites.nftIds = favorites.nftIds.filter((n) => n !== id)
        touch(favorites)
      }
    }
    return favorites
  }
  if (path === '/profile' && method === 'GET') return user
  if (path === '/profile' && method === 'PATCH') {
    if (input.version !== user.version)
      return fail(409, 'CONFLICT', 'Profile version changed')
    if (input.name !== undefined) user.name = text(input.name, 'name', 2, 80)
    if (input.username !== undefined) {
      const username = text(input.username, 'username', 3, 30).toLowerCase()
      if (!/^[a-z0-9_]{3,30}$/.test(username))
        return invalid(
          'Nome de usuário inválido. Use letras, números e sublinhado.',
        )
      if (
        state.users.some(
          (entry) => entry.id !== user.id && entry.username === username,
        )
      )
        return fail(409, 'CONFLICT', 'Nome de usuário já está em uso.')
      user.username = username
    }
    if (input.email !== undefined) {
      const email = text(input.email, 'email', 3).toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return invalid('E-mail inválido.')
      if (
        state.users.some(
          (entry) => entry.id !== user.id && entry.email === email,
        )
      )
        return fail(409, 'CONFLICT', 'E-mail já cadastrado.')
      user.email = email
    }
    if (input.ens !== undefined) {
      const ens =
        input.ens === null || input.ens === ''
          ? null
          : text(input.ens, 'ENS', 5, 255).toLowerCase()
      if (ens && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.eth$/.test(ens))
        return invalid('ENS inválido. Informe um nome .eth.')
      user.ens = ens
    }
    if (input.bio !== undefined) {
      if (typeof input.bio !== 'string' || input.bio.length > 1000)
        return invalid('Invalid bio')
      user.bio = input.bio
    }
    if (input.avatar !== undefined) {
      if (
        input.avatar !== null &&
        (typeof input.avatar !== 'string' ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
            input.avatar,
          ) ||
          input.avatar.length > 1400000)
      )
        return invalid('Avatar must be a PNG, JPEG or WebP data URL under 1MB')
      user.avatar = input.avatar as string | null
    }
    touch(user)
    return user
  }
  if (path === '/profile/password' && method === 'PUT') {
    const credential = state.credentials[user.id]!
    if (
      (
        await passwordHash(
          text(input.currentPassword, 'current password'),
          credential.salt,
        )
      ).hash !== credential.hash
    )
      return fail(403, 'FORBIDDEN', 'Current password does not match')
    state.credentials[user.id] = await passwordHash(
      text(input.newPassword, 'new password', 8, 128),
    )
    for (const [token, value] of Object.entries(state.sessions))
      if (
        value.userId === user.id &&
        request.headers.get('Authorization') !== `Bearer ${token}`
      )
        delete state.sessions[token]
    return undefined
  }
  if (path === '/wallets' || path.startsWith('/wallets/')) {
    if (
      path === '/wallets'
        ? !['GET', 'POST'].includes(method)
        : method !== 'PATCH'
    )
      return fail(404, 'NOT_FOUND', 'Endpoint not found')
    const wallets = (state.wallets[user.id] ??= [])
    if (method === 'GET') return wallets
    const existing =
      path !== '/wallets'
        ? (wallets.find((w) => w.id === path.slice(9)) ??
          fail(404, 'NOT_FOUND', 'Wallet not found'))
        : undefined
    if (existing && input.version !== existing.version)
      return fail(409, 'CONFLICT', 'Wallet version changed')
    const value = walletInput({ ...existing, ...input })
    if (
      wallets.some(
        (w) =>
          w.id !== existing?.id &&
          (value.network === 'solana'
            ? w.address === value.address
            : w.address.toLowerCase() === value.address.toLowerCase()) &&
          w.network === value.network,
      )
    )
      return fail(409, 'CONFLICT', 'Wallet already registered')
    if (value.isDefault)
      for (const wallet of wallets) {
        if (wallet.isDefault) {
          wallet.isDefault = false
          touch(wallet)
        }
      }
    if (existing) {
      Object.assign(existing, value)
      touch(existing)
      return existing
    }
    const wallet = { ...version(), ...value, id: crypto.randomUUID() }
    wallets.push(wallet)
    return wallet
  }
  if (path === '/orders' && method === 'GET') {
    const key = url.searchParams.get('idempotencyKey')
    const orderId = key
      ? state.idempotency[`${user.id}:${key}`]?.orderId
      : undefined
    return state.orders.filter(
      (o) => o.userId === user.id && (!key || o.id === orderId),
    )
  }
  if (path.startsWith('/orders/') && method === 'GET') {
    const order =
      state.orders.find((o) => o.id === path.slice(8)) ??
      fail(404, 'NOT_FOUND', 'Order not found')
    if (order.userId !== user.id)
      return fail(403, 'FORBIDDEN', 'Order belongs to another user')
    return order
  }
  if (path === '/orders' && method === 'POST') {
    const payload: CreateOrderInput = {
        quoteId: text(input.quoteId, 'quote'),
        walletId: text(input.walletId, 'wallet'),
        ...(input.network === undefined
          ? {}
          : {
              network: text(
                input.network,
                'network',
              ) as CreateOrderInput['network'],
            }),
        ...(input.collector === undefined
          ? {}
          : {
              collector: {
                ...(object(input.collector).note === undefined
                  ? {}
                  : {
                      note: text(
                        object(input.collector).note,
                        'collector note',
                        0,
                        1000,
                      ),
                    }),
                name: text(
                  object(input.collector).name,
                  'collector name',
                  2,
                  80,
                ),
                email: text(
                  object(input.collector).email,
                  'collector email',
                  3,
                  200,
                ).toLowerCase(),
              },
            }),
      },
      key = `${user.id}:${text(request.headers.get('Idempotency-Key'), 'idempotency key', 1, 150)}`,
      normalized = JSON.stringify(payload),
      previous = state.idempotency[key]
    if (previous) {
      if (previous.payload !== normalized)
        return fail(
          409,
          'CONFLICT',
          'Idempotency key reused with different payload',
        )
      return state.orders.find((o) => o.id === previous.orderId)!
    }
    if (
      payload.collector &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.collector.email)
    )
      return invalid('Invalid collector email')
    if (state.scenario.orderOutcome === 'timeout-before-create')
      return fail(
        503,
        'TRANSIENT_ERROR',
        'Simulated timeout before order creation; recover or retry the same key',
        false,
        12000,
      )
    if (state.scenario.orderOutcome === 'connection-error')
      return fail(
        0,
        'TRANSIENT_ERROR',
        'Simulated connection failure before order creation',
      )
    const quote = state.quotes[payload.quoteId],
      target = cart(state, request)
    if (
      !quote ||
      quote.cartId !== target.id ||
      quote.cartVersion !== target.version ||
      Date.parse(quote.expiresAt) <= Date.now()
    )
      return fail(409, 'QUOTE_CONFLICT', 'Quote expired or cart changed')
    const wallet =
      state.wallets[user.id]?.find((w) => w.id === payload.walletId) ??
      invalid('Wallet not found')
    if (payload.network && payload.network !== wallet.network)
      return invalid('Wallet network incompatible')
    if (quote.network && quote.network !== wallet.network)
      return fail(
        409,
        'QUOTE_CONFLICT',
        'Quoted network incompatible with wallet',
      )
    const fresh = snapshot(
      state,
      target,
      quote.snapshot.coupon?.code,
      quote.network,
    )
    if (JSON.stringify(fresh) !== JSON.stringify(quote.snapshot))
      return fail(409, 'QUOTE_CONFLICT', 'Quote financial snapshot changed')
    for (const line of quote.snapshot.lines) {
      const { nft, edition } = available(
        state,
        line.nftId,
        line.editionId,
        line.quantity,
      )
      if (
        nft.version !== line.nftVersion ||
        edition.version !== line.editionVersion ||
        wallet.network !== nft.network
      )
        return fail(
          409,
          'QUOTE_CONFLICT',
          'Quote changed or wallet network incompatible',
        )
    }
    const outcome = state.scenario.orderOutcome
    const finalStatus =
      outcome === 'declined'
        ? 'declined'
        : outcome === 'confirmed' || outcome === 'timeout-after-create'
          ? 'confirmed'
          : null
    const resolution =
      outcome === 'pending-confirmed'
        ? 'confirmed'
        : outcome === 'pending-declined'
          ? 'declined'
          : null
    const id = crypto.randomUUID(),
      createdAt = now()
    const order: Order = {
      ...version(),
      id,
      userId: user.id,
      walletId: wallet.id,
      wallet: structuredClone(wallet),
      network: wallet.network,
      collector: payload.collector ?? { name: user.name, email: user.email },
      transactionReference: `demo-${crypto.randomUUID()}`,
      quoteId: quote.id,
      status: 'pending',
      createdAt,
      snapshot: structuredClone(quote.snapshot),
      resolveAt: resolution
        ? new Date(Date.now() + state.scenario.orderResolutionMs).toISOString()
        : null,
      resolution,
      attempts: [
        { id: crypto.randomUUID(), status: 'pending', createdAt, reason: null },
      ],
      receipt: null,
    }
    state.orderCartItems[id] = target.items
      .filter((item) =>
        quote.snapshot.lines.some(
          (line) =>
            line.nftId === item.nftId && line.editionId === item.editionId,
        ),
      )
      .map((item) => ({ id: item.id, quantity: item.quantity }))
    state.orders.push(order)
    state.idempotency[key] = { payload: normalized, orderId: id }
    if (finalStatus) resolveOrder(state, order, finalStatus)
    if (state.scenario.orderOutcome === 'timeout-after-create')
      return fail(
        503,
        'TRANSIENT_ERROR',
        'Simulated timeout after order persistence; retry with the same key',
        true,
        12_000,
      )
    return order
  }
  return fail(404, 'NOT_FOUND', 'Endpoint not found')
}
export function marketplaceHandlers(apiUrl: string) {
  return [
    http.all(`${apiUrl}/*`, async ({ request }) => {
      try {
        const path = new URL(request.url).pathname.slice(
          new URL(apiUrl).pathname.length,
        )
        if (!path.startsWith('/__mock/'))
          await delay(await mockRequestLatency())
        const response = await transaction(async (state) => {
          const result = await route(state, request, path)
          const configured = state.scenario.responseDelays.find(
            (entry) =>
              entry.remaining > 0 &&
              entry.path === path &&
              (!entry.method || entry.method.toUpperCase() === request.method),
          )
          if (configured) configured.remaining--
          return {
            result: structuredClone(result),
            delayMs: configured?.delayMs ?? 0,
          }
        })
        if (response.delayMs) await delay(response.delayMs)
        const result = response.result
        return result === undefined
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json(result, { headers: { 'X-Kurio-Mock': 'msw' } })
      } catch (error) {
        const problem =
          error instanceof DomainError
            ? error
            : new DomainError(500, 'TRANSIENT_ERROR', 'Mock repository failed')
        if (problem.status === 0) return HttpResponse.error()
        if (problem.responseDelayMs) await delay(problem.responseDelayMs)
        return HttpResponse.json(
          {
            error: {
              code: problem.code,
              message: problem.message,
              requestId: crypto.randomUUID(),
              retryable: problem.status === 503 || problem.status === 500,
            },
          },
          { status: problem.status },
        )
      }
    }),
  ]
}
