import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  Nft,
  Order,
  Quote,
  Session,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request, p4Response } from './phase4-helpers.js'

async function prepare(page: Page, outcome = 'confirmed') {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    latencyMs: 0,
    orderOutcome: outcome,
    orderResolutionMs: 1500,
  })
  const session = await p4Request<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
  await p4Request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  return p4Request<Quote>(page, '/quotes', 'POST', { couponCode: 'KURIO10' })
}
const payload = (quote: Quote) => ({
  quoteId: quote.id,
  walletId: 'ana-wallet',
})

test('pending resolution survives reload, applies effects once and preserves later additions', async ({
  page,
}) => {
  const quote = await prepare(page, 'pending-confirmed')
  await page.clock.install()
  const order = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(quote),
    'pending-resume',
  )
  expect(order.status).toBe('pending')
  expect((await p4Request<Cart>(page, '/cart')).items[0]!.quantity).toBe(1)
  await p4Request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  await page.reload()
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await page.clock.fastForward(2000)
  const recovered = await p4Request<Order[]>(
    page,
    '/orders?idempotencyKey=pending-resume',
  )
  expect(recovered).toHaveLength(1)
  expect(recovered[0]!.id).toBe(order.id)
  expect(recovered[0]!.status).toBe('confirmed')
  const again = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(quote),
    'pending-resume',
  )
  expect(again.version).toBe(recovered[0]!.version)
  expect((await p4Request<Cart>(page, '/cart')).items[0]!.quantity).toBe(1)
  expect(
    (await p4Request<Nft>(page, '/nfts/emerald-ape')).editions[0]!.available,
  ).toBe(49)
})

test('pending rejection preserves cart and terminal result despite later scenario', async ({
  page,
}) => {
  const quote = await prepare(page, 'pending-declined')
  await page.clock.install()
  const order = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(quote),
    'pending-decline',
  )
  await page.clock.fastForward(2000)
  const declined = await p4Request<Order>(page, `/orders/${order.id}`)
  expect(declined.status).toBe('declined')
  expect(declined.receipt).toBeNull()
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'confirmed',
  })
  expect(
    (
      await p4Request<Order>(
        page,
        '/orders',
        'POST',
        payload(quote),
        'pending-decline',
      )
    ).status,
  ).toBe('declined')
  expect((await p4Request<Cart>(page, '/cart')).items).toHaveLength(1)
  expect(
    (await p4Request<Nft>(page, '/nfts/emerald-ape')).editions[0]!.available,
  ).toBe(50)
})

test('fresh prices, sold out editions and expired coupons reject stale order snapshots', async ({
  page,
}) => {
  const quote = await prepare(page)
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', {
    priceEth: '1.190000000000000001',
  })
  expect(
    (await p4Response(page, '/orders', 'POST', payload(quote), 'stale-price'))
      .status,
  ).toBe(409)
  const fresh = await p4Request<Quote>(page, '/quotes', 'POST', {
    couponCode: 'KURIO10',
  })
  expect(fresh.snapshot.lines[0]!.unitPriceEth).toBe('1.190000000000000001')
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    expiredCoupons: ['KURIO10'],
  })
  expect(
    (
      await p4Response(
        page,
        '/orders',
        'POST',
        payload(fresh),
        'expired-coupon',
      )
    ).status,
  ).toBe(422)
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', { available: 0 })
  expect(
    (await p4Response(page, '/orders', 'POST', payload(fresh), 'sold-out'))
      .status,
  ).toBe(409)
  expect(await p4Request<Order[]>(page, '/orders')).toHaveLength(0)
})

test('confirmed receipt and wallet snapshot remain immutable after catalog and wallet updates', async ({
  page,
}) => {
  const quote = await prepare(page)
  const order = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    {
      ...payload(quote),
      collector: { name: 'Ana Collector', email: 'ana@kurio.demo' },
      network: 'ethereum',
    },
    'immutable',
  )
  expect(order.status).toBe('confirmed')
  expect(order.snapshot.totalEth).toBe('1.097775')
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', { priceEth: '9' })
  await p4Request(page, '/wallets/ana-wallet', 'PATCH', {
    version: 1,
    label: 'Changed wallet',
  })
  const persisted = await p4Request<Order>(page, `/orders/${order.id}`)
  expect(persisted).toEqual(order)
  expect(persisted.wallet.label).toBe('Carteira Ethereum')
  expect(persisted.receipt!.snapshot).toEqual(quote.snapshot)
  expect(persisted.transactionReference).toMatch(/^demo-/)
  expect(
    (
      await p4Response(
        page,
        '/orders',
        'POST',
        { ...payload(quote), walletId: 'other' },
        'immutable',
      )
    ).status,
  ).toBe(409)
})

test('network failure and timeout before creation preserve cart and recover no phantom order', async ({
  page,
}) => {
  const quote = await prepare(page, 'connection-error')
  await expect(
    p4Request(page, '/orders', 'POST', payload(quote), 'network'),
  ).rejects.toThrow()
  expect(
    await p4Request<Order[]>(page, '/orders?idempotencyKey=network'),
  ).toHaveLength(0)
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'timeout-before-create',
  })
  await expect(
    p4Response(page, '/orders', 'POST', payload(quote), 'before', 200),
  ).rejects.toThrow()
  expect(
    await p4Request<Order[]>(page, '/orders?idempotencyKey=before'),
  ).toHaveLength(0)
  expect((await p4Request<Cart>(page, '/cart')).items).toHaveLength(1)
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'confirmed',
  })
  expect(
    (await p4Request<Order>(page, '/orders', 'POST', payload(quote), 'before'))
      .status,
  ).toBe('confirmed')
})

test('two pending purchases cannot consume negative inventory and removed lines stay replaced', async ({
  page,
}) => {
  const quote = await prepare(page, 'pending-confirmed')
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', { available: 1 })
  const fresh = await p4Request<Quote>(page, '/quotes', 'POST', {})
  await page.clock.install()
  const first = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(fresh),
    'race-one',
  )
  const second = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(fresh),
    'race-two',
  )
  const cart = await p4Request<Cart>(page, '/cart')
  await p4Request(page, `/cart/items/${cart.items[0]!.id}`, 'DELETE')
  await p4Request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  await page.clock.fastForward(2000)
  expect((await p4Request<Order>(page, `/orders/${first.id}`)).status).toBe(
    'confirmed',
  )
  expect((await p4Request<Order>(page, `/orders/${second.id}`)).status).toBe(
    'declined',
  )
  expect(
    (await p4Request<Nft>(page, '/nfts/emerald-ape')).editions[0]!.available,
  ).toBe(0)
  expect((await p4Request<Cart>(page, '/cart')).items).toHaveLength(1)
  expect(quote.snapshot.lines).toHaveLength(1)
})

test('late REST pending snapshot cannot regress a newer order delivered by Socket.IO', async ({
  page,
}) => {
  const quote = await prepare(page, 'pending-confirmed')
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderResolutionMs: 5000,
  })
  const order = await p4Request<Order>(
    page,
    '/orders',
    'POST',
    payload(quote),
    'late-rest',
  )
  const path = `/orders/${order.id}`
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    responseDelays: [{ path, method: 'GET', delayMs: 7000, remaining: 2 }],
  })
  const firstRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `/api${path}` &&
      request.method() === 'GET',
  )
  await page.goto(path)
  await firstRequest
  await expect(page.getByTestId('realtime-status')).toHaveText(
    'Tempo real conectado',
  )
  const lateResponse = p4Request<Order>(page, path)
  await expect(
    page.getByRole('heading', { name: 'Pedido confirmado', exact: true }),
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('realtime-status')).toHaveAttribute(
    'data-order-events',
    /[1-9]\d*/,
  )
  const stale = await lateResponse
  expect(stale.status).toBe('pending')
  expect(stale.version).toBeLessThan(2)
  await expect(
    page.getByRole('heading', { name: 'Pedido confirmado', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Pedido pendente', exact: true }),
  ).toHaveCount(0)
  expect((await p4Request<Order>(page, path)).status).toBe('confirmed')
})
