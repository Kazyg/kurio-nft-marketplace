import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  Network,
  Nft,
  Order,
  Quote,
  Session,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request, p4Response } from './phase4-helpers.js'

async function prepare(page: Page) {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
  const session = await p4Request<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
  for (const nftId of ['emerald-ape', 'sage-nomad'])
    await p4Request(page, '/cart/items', 'POST', {
      nftId,
      editionId: `${nftId}-standard`,
      quantity: 1,
    })
  return p4Request<Wallet>(page, '/wallets', 'POST', {
    label: 'Polygon principal',
    address: `0x${'2'.repeat(40)}`,
    network: 'polygon',
    provider: 'metamask',
    isDefault: true,
  })
}

for (const network of ['ethereum', 'polygon'] as Network[]) {
  test(`REST purchases only ${network} and preserves other-network items through refresh and idempotent replay`, async ({
    page,
  }) => {
    const polygon = await prepare(page)
    const quote = await p4Request<Quote>(page, '/quotes', 'POST', {
      network,
      couponCode: 'KURIO10',
    })
    expect(quote.network).toBe(network)
    expect(quote.snapshot.lines).toHaveLength(1)
    const purchasedId = network === 'ethereum' ? 'emerald-ape' : 'sage-nomad'
    const retainedId = network === 'ethereum' ? 'sage-nomad' : 'emerald-ape'
    expect(quote.snapshot.lines[0]!.nftId).toBe(purchasedId)
    const retainedBefore = await p4Request<Nft>(page, `/nfts/${retainedId}`)
    const input = {
      quoteId: quote.id,
      walletId: network === 'ethereum' ? 'ana-wallet' : polygon.id,
      network,
      collector: {
        name: 'Ana',
        email: 'ana@kurio.demo',
        note: 'Minha coleção.',
      },
    }
    const key = `network-purchase-${network}`
    const order = await p4Request<Order>(page, '/orders', 'POST', input, key)
    expect(order.status).toBe('confirmed')
    expect(order.network).toBe(network)
    expect(order.collector.note).toBe('Minha coleção.')
    expect(order.receipt?.snapshot).toEqual(quote.snapshot)
    const cart = await p4Request<Cart>(page, '/cart')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]!.nftId).toBe(retainedId)
    expect(cart.items[0]!.quantity).toBe(1)
    expect(await p4Request<Nft>(page, `/nfts/${retainedId}`)).toEqual(
      retainedBefore,
    )
    await page.reload()
    await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
    expect((await p4Request<Cart>(page, '/cart')).items).toEqual(cart.items)
    expect(
      (await p4Request<Order>(page, '/orders', 'POST', input, key)).id,
    ).toBe(order.id)
    expect((await p4Request<Cart>(page, '/cart')).items).toEqual(cart.items)
  })
}

test('REST rejects incompatible wallet for scoped and full mixed quotes without losing cart', async ({
  page,
}) => {
  const polygon = await prepare(page)
  const cart = await p4Request<Cart>(page, '/cart')
  const ethereum = await p4Request<Quote>(page, '/quotes', 'POST', {
    network: 'ethereum',
  })
  expect(
    (
      await p4Response(
        page,
        '/orders',
        'POST',
        {
          quoteId: ethereum.id,
          walletId: polygon.id,
        },
        'wrong-wallet',
      )
    ).status,
  ).toBe(409)
  const mixed = await p4Request<Quote>(page, '/quotes', 'POST', {})
  expect(mixed.snapshot.lines).toHaveLength(2)
  expect(
    (
      await p4Response(
        page,
        '/orders',
        'POST',
        {
          quoteId: mixed.id,
          walletId: 'ana-wallet',
        },
        'mixed-network',
      )
    ).status,
  ).toBe(409)
  expect(await p4Request<Cart>(page, '/cart')).toEqual(cart)
  expect(await p4Request<Order[]>(page, '/orders')).toEqual([])
})

test('REST validates scoped network and rechecks current price before creating order', async ({
  page,
}) => {
  await prepare(page)
  for (const network of ['Ethereum', 'solana', '', null])
    expect(
      (await p4Response(page, '/quotes', 'POST', { network })).status,
    ).toBe(422)
  const quote = await p4Request<Quote>(page, '/quotes', 'POST', {
    network: 'ethereum',
  })
  await p4Request(page, '/__mock/nfts/emerald-ape', 'PATCH', {
    editionId: 'emerald-ape-standard',
    priceEth: '2.19',
  })
  expect(
    (
      await p4Response(
        page,
        '/orders',
        'POST',
        {
          quoteId: quote.id,
          walletId: 'ana-wallet',
          network: 'ethereum',
        },
        'scoped-stale-price',
      )
    ).status,
  ).toBe(409)
  expect((await p4Request<Cart>(page, '/cart')).items).toHaveLength(2)
  expect(await p4Request<Order[]>(page, '/orders')).toEqual([])
})

test('wallet optional form metadata persists with existing REST version and default-wallet rules', async ({
  page,
}) => {
  const wallet = await prepare(page)
  const metadata = {
    displayName: 'Ana colecionadora',
    profileName: 'ana_kurio',
    secondaryAddress: 'ana.eth',
    referralCode: 'KURIO-ANA',
    email: 'ana@kurio.demo',
    ens: 'ana.eth',
  }
  const updated = await p4Request<Wallet>(
    page,
    `/wallets/${wallet.id}`,
    'PATCH',
    {
      ...metadata,
      version: wallet.version,
    },
  )
  expect(updated).toMatchObject(metadata)
  expect(updated.version).toBe(wallet.version + 2)
  expect(
    (
      await p4Response(page, `/wallets/${wallet.id}`, 'PATCH', {
        version: wallet.version,
        label: 'Rascunho antigo',
      })
    ).status,
  ).toBe(409)
  expect(
    (await p4Request<Wallet[]>(page, '/wallets')).filter(
      (entry) => entry.isDefault,
    ),
  ).toHaveLength(1)
  expect(
    (
      await p4Response(page, `/wallets/${wallet.id}`, 'PATCH', {
        version: updated.version,
        email: 'invalid',
      })
    ).status,
  ).toBe(422)
  await page.reload()
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  expect(
    (await p4Request<Wallet[]>(page, '/wallets')).find(
      (entry) => entry.id === wallet.id,
    ),
  ).toMatchObject(metadata)
})
