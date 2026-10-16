import type {
  ApiErrorBody,
  Cart,
  Favorites,
  MockScenario,
  Order,
  Quote,
  Session,
  User,
} from '../src/shared/contracts/marketplace.js'
type Payload = Cart &
  Favorites &
  MockScenario &
  Order &
  Quote &
  Session &
  User &
  ApiErrorBody
import { expect, test } from '@playwright/test'
import { resetMocks } from './helpers.js'

test('aborted response after creation recovers one persisted order immediately', async ({
  page,
}) => {
  await resetMocks(page)
  const result = await page.evaluate(async () => {
    let token = ''
    const call = async (
      path: string,
      method = 'GET',
      body?: unknown,
      signal?: AbortSignal,
    ) => {
      const response = await fetch(`/api${path}`, {
        method,
        signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Id': 'abort-guest',
          'Idempotency-Key': 'abort-after-create',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return (await response.json()) as Payload
    }
    await call('/__mock/scenario', 'PATCH', {
      latencyMs: 0,
      orderOutcome: 'timeout-after-create',
    })
    token = (
      await call('/auth/login', 'POST', {
        email: 'ana@kurio.demo',
        password: 'Kurio123!',
      })
    ).accessToken!
    await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 1,
    })
    const quote = await call('/quotes', 'POST', {})
    const payload = { quoteId: quote.id, walletId: 'ana-wallet' }
    const controller = new AbortController()
    const pendingResponse = call('/orders', 'POST', payload, controller.signal)
    const timeout = setTimeout(() => controller.abort(), 300)
    let aborted = false
    try {
      await pendingResponse
    } catch (error) {
      aborted = error instanceof DOMException && error.name === 'AbortError'
    } finally {
      clearTimeout(timeout)
    }
    const startedAt = performance.now()
    const recovered = await call('/orders', 'POST', payload)
    const recoveredAgain = await call('/orders', 'POST', payload)
    const orders = (await (
      await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json()) as Order[]
    return {
      aborted,
      status: recovered.status,
      sameOrder: recovered.id === recoveredAgain.id,
      count: orders.length,
      recoveryMs: performance.now() - startedAt,
    }
  })
  expect(result.aborted).toBe(true)
  expect(result.status).toBe('confirmed')
  expect(result.sameOrder).toBe(true)
  expect(result.count).toBe(1)
  expect(result.recoveryMs).toBeLessThan(2000)
})

test('REST domain isolates users, merges guest cart and persists exact idempotent orders', async ({
  page,
}) => {
  await resetMocks(page)
  const result = await page.evaluate(async () => {
    let token = ''
    const call = async (
      path: string,
      method = 'GET',
      body?: unknown,
      key?: string,
    ) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Id': 'domain-test-guest',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return {
        status: response.status,
        body:
          response.status === 204 ? null : ((await response.json()) as Payload),
      }
    }
    await call('/__mock/scenario', 'PATCH', { latencyMs: 0 })
    await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 2,
    })
    const ana = await call('/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    token = ana.body!.accessToken!
    const merged = await call('/cart')
    await call('/favorites/emerald-ape', 'PUT')
    const quote = await call('/quotes', 'POST', { couponCode: 'KURIO10' })
    await call('/__mock/scenario', 'PATCH', {
      orderOutcome: 'timeout-after-create',
    })
    const payload = { quoteId: quote.body!.id, walletId: 'ana-wallet' }
    const timeout = await call('/orders', 'POST', payload, 'persist-key')
    const recovered = await call('/orders', 'POST', payload, 'persist-key')
    const mismatch = await call(
      '/orders',
      'POST',
      { ...payload, walletId: 'another' },
      'persist-key',
    )
    const anaToken = token
    const bruno = await call('/auth/login', 'POST', {
      email: 'bruno@kurio.demo',
      password: 'Kurio123!',
    })
    token = bruno.body!.accessToken!
    const favorites = await call('/favorites'),
      orders = await call('/orders'),
      forbidden = await call(`/orders/${recovered.body!.id}`),
      privateCart = await call('/cart')
    localStorage.setItem('domain-test-token', anaToken)
    localStorage.setItem('domain-test-payload', JSON.stringify(payload))
    localStorage.setItem('domain-test-order', recovered.body!.id)
    return {
      merged: merged.body!.items[0].quantity,
      total: quote.body!.snapshot.totalEth,
      subtotal: quote.body!.snapshot.subtotalEth,
      discount: quote.body!.snapshot.discountEth,
      fee: quote.body!.snapshot.feeEth,
      timeout: timeout.status,
      recovered: recovered.status,
      mismatch: mismatch.status,
      favorites: favorites.body!.nftIds,
      orders: orders.body,
      forbidden: forbidden.status,
      privateCart: privateCart.body!.items,
    }
  })
  expect(result).toEqual({
    merged: 2,
    total: '2.19555',
    subtotal: '2.38',
    discount: '0.238',
    fee: '0.05355',
    timeout: 503,
    recovered: 200,
    mismatch: 409,
    favorites: [],
    orders: [],
    forbidden: 403,
    privateCart: [],
  })
  await page.reload()
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  const persisted = await page.evaluate(async () => {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('domain-test-token')}`,
        'Idempotency-Key': 'persist-key',
      },
      body: localStorage.getItem('domain-test-payload'),
    })
    const order = (await response.json()) as Payload
    return {
      status: response.status,
      matches: order.id === localStorage.getItem('domain-test-order'),
      total: order.receipt!.snapshot.totalEth,
    }
  })
  expect(persisted).toEqual({ status: 200, matches: true, total: '2.19555' })
})

test('quote conflicts, availability, expiry, versions and scenario failures are deterministic', async ({
  page,
}) => {
  await resetMocks(page)
  const result = await page.evaluate(async () => {
    let token = ''
    const call = async (path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Id': 'conflict-guest',
          'Idempotency-Key': crypto.randomUUID(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return {
        status: response.status,
        body:
          response.status === 204 ? null : ((await response.json()) as Payload),
      }
    }
    await call('/__mock/scenario', 'PATCH', { latencyMs: 0 })
    const login = await call('/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    token = login.body!.accessToken!
    const unavailable = await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 51,
    })
    await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 1,
    })
    const quote = await call('/quotes', 'POST', {})
    await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 1,
    })
    const conflict = await call('/orders', 'POST', {
      quoteId: quote.body!.id,
      walletId: 'ana-wallet',
    })
    const expiredCoupon = await call('/quotes', 'POST', {
      couponCode: 'EXPIRED',
    })
    const profileConflict = await call('/profile', 'PATCH', {
      version: 99,
      name: 'Wrong',
    })
    await call('/__mock/scenario', 'PATCH', {
      failures: [
        { path: '/favorites/*', method: 'PUT', status: 503, remaining: 1 },
      ],
    })
    const failure = await call('/favorites/emerald-ape', 'PUT'),
      retry = await call('/favorites/emerald-ape', 'PUT')
    const scenario = await call('/__mock/scenario')
    await call('/__mock/scenario', 'PATCH', { sessionTtlMs: 0 })
    const expiredLogin = await call('/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    token = expiredLogin.body!.accessToken!
    const expiredSession = await call('/auth/session')
    return {
      unavailable: unavailable.body!.error.code,
      conflict: conflict.body!.error.code,
      expiredCoupon: expiredCoupon.status,
      profileConflict: profileConflict.status,
      failure: failure.status,
      retry: retry.status,
      remaining: scenario.body!.failures[0].remaining,
      expiredSession: expiredSession.status,
    }
  })
  expect(result).toEqual({
    unavailable: 'UNAVAILABLE',
    conflict: 'QUOTE_CONFLICT',
    expiredCoupon: 422,
    profileConflict: 409,
    failure: 503,
    retry: 200,
    remaining: 0,
    expiredSession: 401,
  })
})

test('concurrent pages share idempotency lock and invalid profile changes roll back', async ({
  page,
  context,
}) => {
  await resetMocks(page)
  const preparation = await page.evaluate(async () => {
    const call = async (
      path: string,
      method: string,
      body: unknown,
      token?: string,
    ) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Id': 'concurrent',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      return response.json() as Promise<Payload>
    }
    await call('/__mock/scenario', 'PATCH', { latencyMs: 0 })
    const login = await call('/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    await call(
      '/cart/items',
      'POST',
      { nftId: 'emerald-ape', editionId: 'emerald-ape-standard', quantity: 1 },
      login.accessToken!,
    )
    const quote = await call('/quotes', 'POST', {}, login.accessToken!)
    return { token: login.accessToken as string, quoteId: quote.id as string }
  })
  const second = await context.newPage()
  await second.goto('/diagnostics')
  await expect(second.getByTestId('http-status')).toHaveText('HTTP conectado')
  const create = (target: typeof page) =>
    target.evaluate(async ({ token, quoteId }) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': 'cross-tab',
        },
        body: JSON.stringify({ quoteId, walletId: 'ana-wallet' }),
      })
      return {
        status: response.status,
        order: (await response.json()) as Payload,
      }
    }, preparation)
  const [firstOrder, secondOrder] = await Promise.all([
    create(page),
    create(second),
  ])
  expect(firstOrder.status).toBe(200)
  expect(secondOrder.status).toBe(200)
  expect(firstOrder.order.id).toBe(secondOrder.order.id)
  const profile = await page.evaluate(async ({ token }) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
    const before = (await (
      await fetch('/api/profile', { headers })
    ).json()) as User
    const invalid = await fetch('/api/profile', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        version: before.version,
        name: 'Must roll back',
        bio: 'x'.repeat(1001),
      }),
    })
    const after = (await (
      await fetch('/api/profile', { headers })
    ).json()) as User
    return {
      status: invalid.status,
      unchanged: JSON.stringify(before) === JSON.stringify(after),
    }
  }, preparation)
  expect(profile).toEqual({ status: 422, unchanged: true })
})

test('registration, credentials, wallets and pending or declined orders stay in domain', async ({
  page,
}) => {
  await resetMocks(page)
  const results = await page.evaluate(async () => {
    let token = ''
    const call = async (path: string, method = 'GET', body?: unknown) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Id': 'registration-guest',
          'Idempotency-Key': crypto.randomUUID(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return {
        status: response.status,
        body:
          response.status === 204 ? null : ((await response.json()) as Payload),
      }
    }
    await call('/__mock/scenario', 'PATCH', {
      latencyMs: 0,
      orderOutcome: 'declined',
    })
    const registered = await call('/auth/register', 'POST', {
      name: 'Clara',
      email: 'clara@kurio.demo',
      password: 'Original123!',
    })
    token = registered.body!.accessToken!
    const duplicate = await call('/auth/register', 'POST', {
      name: 'Clara',
      email: 'clara@kurio.demo',
      password: 'Original123!',
    })
    const profile = await call('/profile', 'PATCH', {
      version: 1,
      name: 'Clara Artist',
      bio: 'Digital art',
      avatar: 'data:image/png;base64,aGVsbG8=',
    })
    const wallet = await call('/wallets', 'POST', {
      label: 'My demo wallet',
      address: `0x${'a'.repeat(40)}`,
      network: 'ethereum',
      provider: 'metamask',
      isDefault: true,
    })
    await call('/cart/items', 'POST', {
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 1,
    })
    const quote = await call('/quotes', 'POST', {})
    const declined = await call('/orders', 'POST', {
      quoteId: quote.body!.id,
      walletId: wallet.body!.id,
    })
    const retained = await call('/cart')
    await call('/__mock/scenario', 'PATCH', { orderOutcome: 'pending' })
    const pending = await call('/orders', 'POST', {
      quoteId: quote.body!.id,
      walletId: wallet.body!.id,
    })
    const password = await call('/profile/password', 'PUT', {
      currentPassword: 'Original123!',
      newPassword: 'Changed123!',
    })
    const oldPassword = await call('/auth/login', 'POST', {
      email: 'clara@kurio.demo',
      password: 'Original123!',
    })
    const newPassword = await call('/auth/login', 'POST', {
      email: 'clara@kurio.demo',
      password: 'Changed123!',
    })
    await call('/auth/logout', 'POST')
    const loggedOut = await call('/profile')
    return {
      registered: registered.status,
      duplicate: duplicate.status,
      profile: profile.body!.version,
      avatar: profile.body!.avatar,
      wallet: wallet.status,
      declined: declined.body!.status,
      declinedReceipt: declined.body!.receipt,
      retained: retained.body!.items.length,
      pending: pending.body!.status,
      pendingReceipt: pending.body!.receipt,
      password: password.status,
      oldPassword: oldPassword.status,
      newPassword: newPassword.status,
      loggedOut: loggedOut.status,
    }
  })
  expect(results).toEqual({
    registered: 200,
    duplicate: 409,
    profile: 2,
    avatar: 'data:image/png;base64,aGVsbG8=',
    wallet: 200,
    declined: 'declined',
    declinedReceipt: null,
    retained: 1,
    pending: 'pending',
    pendingReceipt: null,
    password: 204,
    oldPassword: 401,
    newPassword: 200,
    loggedOut: 401,
  })
})
