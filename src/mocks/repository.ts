import type { DomainEvent } from '@/shared/contracts/realtime'
import type {
  Cart,
  Favorites,
  MockScenario,
  Nft,
  Order,
  Quote,
  User,
  Wallet,
} from '@/shared/contracts/marketplace'
import { createNfts, legacyNftDescription, legacyNftDetails } from './fixtures'
import { testAccountWallets } from './test-account'
const nftDefaults = new Map(createNfts().map((nft) => [nft.id, nft]))
const initialLatencyMs = 120
export interface Credential {
  salt: string
  hash: string
}
export interface State {
  testAccountVersion?: number
  events: DomainEvent[]
  eventSequence: number
  nfts: Nft[]
  users: User[]
  credentials: Record<string, Credential>
  sessions: Record<string, { userId: string; expiresAt: string }>
  carts: Record<string, Cart>
  favorites: Record<string, Favorites>
  wallets: Record<string, Wallet[]>
  quotes: Record<string, Quote>
  orderCartItems: Record<string, { id: string; quantity: number }[]>
  orders: Order[]
  idempotency: Record<string, { payload: string; orderId: string }>
  scenario: MockScenario
}
export const now = () => new Date().toISOString()
export const version = () => ({ version: 1, updatedAt: now() })
export function touch(resource: { version: number; updatedAt: string }) {
  resource.version++
  resource.updatedAt = now()
}
const encode = (data: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(data))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
export async function passwordHash(
  password: string,
  salt = encode(crypto.getRandomValues(new Uint8Array(16))),
): Promise<Credential> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const hash = encode(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  )
  return { salt, hash }
}
async function seed(): Promise<State> {
  const users = ['Ana', 'Bruno'].map((name) => ({
    ...version(),
    id: name.toLowerCase(),
    name,
    email: `${name.toLowerCase()}@kurio.demo`,
    avatar: null,
    bio: '',
    username: name.toLowerCase(),
    ens: null,
  }))
  const credentials: State['credentials'] = {}
  for (const user of users)
    credentials[user.id] = await passwordHash('Kurio123!')
  return {
    testAccountVersion: 0,
    events: [],
    eventSequence: 0,
    nfts: createNfts(),
    users,
    credentials,
    sessions: {},
    carts: {},
    favorites: {},
    wallets: Object.fromEntries(
      users.map((user, i) => [
        user.id,
        user.id === 'ana'
          ? testAccountWallets(now())
          : [
              {
                ...version(),
                id: `${user.id}-wallet`,
                label: 'Carteira Ethereum',
                address: `0x${String(i + 1).repeat(40)}`,
                network: 'ethereum',
                provider: 'metamask',
                isDefault: true,
              },
            ],
      ]),
    ),
    quotes: {},
    orderCartItems: {},
    orders: [],
    idempotency: {},
    scenario: {
      responseDelays: [],
      latencyMs: initialLatencyMs,
      orderResolutionMs: 2500,
      expiredCoupons: [],
      failures: [],
      orderOutcome: 'confirmed',
      sessionTtlMs: 3600000,
      quoteTtlMs: 300000,
    },
  }
}
export function resolveOrder(
  state: State,
  order: Order,
  result: 'confirmed' | 'declined',
) {
  if (order.status !== 'pending') return
  if (result === 'confirmed') {
    const sufficient = order.snapshot.lines.every((line) => {
      const nft = state.nfts.find((n) => n.id === line.nftId)
      return (
        (nft?.editions.find((e) => e.id === line.editionId)?.available ?? -1) >=
        line.quantity
      )
    })
    if (!sufficient) result = 'declined'
  }
  order.status = result
  order.resolveAt = null
  order.resolution = null
  order.attempts.push({
    id: crypto.randomUUID(),
    status: result,
    createdAt: now(),
    reason:
      result === 'declined'
        ? 'Pagamento recusado ou edição indisponível.'
        : null,
  })
  touch(order)
  if (result !== 'confirmed') return
  for (const line of order.snapshot.lines) {
    const nft = state.nfts.find((n) => n.id === line.nftId)!
    const edition = nft.editions.find((e) => e.id === line.editionId)!
    edition.available -= line.quantity
    touch(edition)
    touch(nft)
  }
  const target = state.carts[`user:${order.userId}`]
  if (target) {
    for (const line of order.snapshot.lines) {
      const purchased = state.orderCartItems[order.id]
      const item = target.items.find(
        (i) =>
          i.nftId === line.nftId &&
          i.editionId === line.editionId &&
          (!purchased || purchased.some((p) => p.id === i.id)),
      )
      if (item) item.quantity = Math.max(0, item.quantity - line.quantity)
    }
    target.items = target.items.filter((i) => i.quantity > 0)
    touch(target)
  }
  order.receipt = {
    id: crypto.randomUUID(),
    orderId: order.id,
    issuedAt: now(),
    snapshot: structuredClone(order.snapshot),
  }
}
export function resolvePending(state: State) {
  for (const order of state.orders)
    if (
      order.status === 'pending' &&
      order.resolveAt &&
      order.resolution &&
      Date.parse(order.resolveAt) <= Date.now()
    )
      resolveOrder(state, order, order.resolution)
}
function recordEvents(state: State, before: State) {
  for (const nft of state.nfts) {
    const previous = before.nfts.find((n) => n.id === nft.id)
    if (previous && previous.version !== nft.version)
      state.events.push({
        eventId: crypto.randomUUID(),
        sequence: ++state.eventSequence,
        type: 'nft.updated',
        nftId: nft.id,
        version: nft.version,
        updatedAt: nft.updatedAt,
        nft: structuredClone(nft),
      })
  }
  for (const order of state.orders) {
    if (before.orders.find((o) => o.id === order.id)?.version !== order.version)
      state.events.push({
        eventId: crypto.randomUUID(),
        sequence: ++state.eventSequence,
        type: 'order.updated',
        orderId: order.id,
        userId: order.userId,
        version: order.version,
        updatedAt: order.updatedAt,
        order: structuredClone(order),
      })
  }
  state.events = state.events.slice(-512)
}
export function realtimeSnapshot(
  accessToken: string | null,
  afterSequence = 0,
) {
  return transaction((state) => {
    const session = accessToken ? state.sessions[accessToken] : undefined
    const userId =
      session && Date.parse(session.expiresAt) > Date.now()
        ? session.userId
        : null
    return {
      userId,
      sequence: state.eventSequence,
      events: state.events.filter(
        (e) =>
          e.sequence > afterSequence &&
          (e.type === 'nft.updated' || e.userId === userId),
      ),
    }
  })
}
let database: Promise<IDBDatabase> | undefined
function db() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('kurio-mock-domain-v2', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('state')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}
async function read(): Promise<State | undefined> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const request = database
      .transaction('state')
      .objectStore('state')
      .get('domain')
    request.onsuccess = () => resolve(request.result as State | undefined)
    request.onerror = () => reject(request.error)
  })
}
async function write(state: State) {
  const database = await db()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('state', 'readwrite')
    tx.objectStore('state').put(state, 'domain')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
export async function mockRequestLatency() {
  return (await read())?.scenario.latencyMs ?? initialLatencyMs
}
let queue: Promise<unknown> = Promise.resolve()
export function transaction<T>(
  operation: (state: State) => Promise<T> | T,
): Promise<T> {
  const operationWithLock = async () => {
    const state = (await read()) ?? (await seed())
    if (!state.testAccountVersion) {
      const ana = state.users.find((user) => user.id === 'ana')
      if (ana) {
        ana.ens ||= 'ana.eth'
        const wallets = (state.wallets.ana ??= [])
        for (const preset of testAccountWallets(now())) {
          const existing = wallets.find(
            (wallet) => wallet.network === preset.network,
          )
          if (!existing)
            wallets.push({
              ...preset,
              isDefault:
                !wallets.some((wallet) => wallet.isDefault) && preset.isDefault,
            })
          else {
            existing.displayName ||= ana.name
            existing.profileName ||= ana.username
            existing.email ||= ana.email
            existing.ens ??= preset.ens
            if (existing.label === 'Demo wallet') existing.label = preset.label
          }
        }
      }
      state.testAccountVersion = 1
    }
    for (const nft of state.nfts) {
      const defaults = nftDefaults.get(nft.id)
      if (!defaults || defaults.network !== nft.network) continue
      nft.technical ??= structuredClone(defaults.technical)
      if (nft.description === legacyNftDescription)
        nft.description = defaults.description
      if (
        nft.description ===
        'Um colecionável digital finalizado à mão, com arte desbloqueável e acesso para colecionadores nesta demonstração.'
      )
        nft.description = defaults.description
      if (
        nft.details ===
        `${nft.name} explora identidade, movimento e luz em um mundo digital sem fronteiras. Seus atributos e referências técnicas pertencem ao catálogo simulado da Kurio.`
      )
        nft.details = defaults.details
      if (nft.details === legacyNftDetails) nft.details = defaults.details
    }
    for (const user of state.users) {
      user.username ??= user.id.replace(/-/g, '').slice(0, 30)
      user.ens ??= null
    }
    for (const order of state.orders) {
      const user = state.users.find((entry) => entry.id === order.userId)
      const wallet = state.wallets[order.userId]?.find(
        (entry) => entry.id === order.walletId,
      )
      order.wallet ??= structuredClone(
        wallet ?? {
          ...version(),
          id: order.walletId,
          label: 'Historical demo wallet',
          address: 'Unavailable in legacy snapshot',
          network: 'ethereum' as const,
          provider: 'metamask' as const,
          isDefault: false,
        },
      )
      order.network ??= order.wallet.network
      order.collector ??= {
        name: user?.name ?? 'Collector',
        email: user?.email ?? '',
      }
      order.transactionReference ??= `demo-${order.id}`
      order.resolveAt ??= null
      order.resolution ??= null
    }
    state.orderCartItems ??= {}
    state.events ??= []
    state.eventSequence ??= 0
    state.scenario.responseDelays ??= []
    state.scenario.orderResolutionMs ??= 2500
    state.scenario.expiredCoupons ??= []
    const before = structuredClone(state)
    resolvePending(state)
    const resolved = structuredClone(state)
    try {
      const result = await operation(state)
      recordEvents(state, before)
      await write(state)
      return result
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'commit' in error &&
        error.commit === true
      ) {
        recordEvents(state, before)
        await write(state)
      } else {
        recordEvents(resolved, before)
        await write(resolved)
      }
      throw error
    }
  }
  const task = queue.then(() =>
    navigator.locks.request('kurio-mock-domain', operationWithLock),
  )
  queue = task.catch(() => undefined)
  return task
}
export async function reset(state: State) {
  Object.assign(state, await seed())
}
