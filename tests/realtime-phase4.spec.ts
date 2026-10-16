import { expect, test, type Page } from '@playwright/test'
import type {
  Order,
  Quote,
  Session,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request } from './phase4-helpers.js'

async function connected(page: Page) {
  await expect(page.getByTestId('realtime-status')).toHaveText(
    'Tempo real conectado',
  )
}
async function events(page: Page) {
  return Number(
    await page.getByTestId('realtime-status').getAttribute('data-events'),
  )
}
async function login(page: Page, email = 'ana@kurio.demo') {
  const session = await p4Request<Session>(page, '/auth/login', 'POST', {
    email,
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
  await page.goto('/')
  await connected(page)
}
async function pendingOrder(page: Page) {
  await p4Request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  const quote = await p4Request<Quote>(page, '/quotes', 'POST', {})
  return p4Request<Order>(
    page,
    '/orders',
    'POST',
    { quoteId: quote.id, walletId: 'ana-wallet' },
    crypto.randomUUID(),
  )
}

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
})

test('Socket.IO delivers nft.updated and rejects replayed duplicate and older versions', async ({
  page,
}) => {
  await page.goto('/?q=Emerald')
  await connected(page)
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', {
    priceEth: '1.234',
  })
  await expect.poll(() => events(page)).toBe(1)
  await expect(
    page
      .getByTestId('catalog-card')
      .filter({ hasText: 'Emerald' })
      .getByText('1.234 ETH'),
  ).toBeVisible()
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', {
    priceEth: '1.345',
  })
  await expect.poll(() => events(page)).toBe(2)
  await p4Request(page, '/__mock/realtime', 'POST', {
    action: 'replay',
    reverse: true,
  })
  await expect(
    page
      .getByTestId('catalog-card')
      .filter({ hasText: 'Emerald' })
      .getByText('1.345 ETH'),
  ).toBeVisible()
  await expect(page.getByTestId('realtime-status')).toHaveAttribute(
    'data-events',
    '2',
  )
})

test('Socket.IO order.updated reaches owner and REST recovers same pending order after reconnect and refresh', async ({
  page,
}) => {
  await login(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'pending-confirmed',
    orderResolutionMs: 5000,
  })
  const order = await pendingOrder(page)
  expect(order.status).toBe('pending')
  await expect.poll(() => events(page)).toBeGreaterThan(0)
  await expect(page.getByTestId('realtime-status')).toHaveAttribute(
    'data-order-events',
    /[1-9]\d*/,
  )
  await p4Request(page, '/__mock/realtime', 'POST', { action: 'disconnect' })
  await page.reload()
  await connected(page)
  await expect
    .poll(
      async () => (await p4Request<Order>(page, `/orders/${order.id}`)).status,
    )
    .toBe('confirmed')
  await expect.poll(() => events(page)).toBeGreaterThan(0)
  const orders = await p4Request<Order[]>(page, '/orders')
  expect(orders.map((item) => item.id)).toEqual([order.id])
})

test('subscriptions replace identity and never deliver another user order', async ({
  page,
}) => {
  await login(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'pending-declined',
    orderResolutionMs: 800,
  })
  const order = await pendingOrder(page)
  await expect.poll(() => events(page)).toBeGreaterThan(0)
  await login(page, 'bruno@kurio.demo')
  expect(await events(page)).toBe(0)
  await expect
    .poll(async () => {
      await p4Request(page, '/__mock/realtime', 'POST', { action: 'replay' })
      return events(page)
    })
    .toBe(0)
  expect(await p4Request<Order[]>(page, '/orders')).toEqual([])
  await login(page)
  await expect
    .poll(
      async () => (await p4Request<Order>(page, `/orders/${order.id}`)).status,
    )
    .toBe('declined')
  await p4Request(page, '/__mock/realtime', 'POST', { action: 'replay' })
  await expect.poll(() => events(page)).toBeGreaterThan(0)
})

test('SPA logout removes the old authenticated subscription before another UI login', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  const signIn = async (email: string) => {
    const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
    await dialog.getByLabel('E-mail', { exact: true }).fill(email)
    await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await connected(page)
  }
  await signIn('ana@kurio.demo')
  await page.evaluate(() => {
    document.documentElement.dataset.subscriptionTest = 'same-document'
  })
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    orderOutcome: 'pending-declined',
    orderResolutionMs: 1500,
  })
  await pendingOrder(page)
  await expect.poll(() => events(page)).toBeGreaterThan(0)
  await page
    .locator('.site-header')
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login/)
  await signIn('bruno@kurio.demo')
  await expect(page.getByTestId('realtime-status')).toHaveAttribute(
    'data-user-id',
    'bruno',
  )
  const baseline = await events(page)
  await p4Request(page, '/__mock/realtime', 'POST', {
    action: 'replay',
    reverse: true,
  })
  await expect(page.getByTestId('realtime-status')).toHaveAttribute(
    'data-events',
    String(baseline),
  )
  expect(
    await page.evaluate(
      () => document.documentElement.dataset.subscriptionTest,
    ),
  ).toBe('same-document')
  expect(await p4Request<Order[]>(page, '/orders')).toEqual([])
})
