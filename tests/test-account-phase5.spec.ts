import { expect, test } from '@playwright/test'
import type {
  Session,
  Wallet,
  NftList,
  Order,
  Cart,
  User,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks, scenario } from './helpers.js'
import { p4Request as request } from './phase4-helpers.js'

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
  const session = await request<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })

  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
})

test('migração completa Ana uma vez e preserva perfil, estoque, carrinho e pedido', async ({
  page,
}) => {
  await request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  const quote = await request<{ id: string }>(page, '/quotes', 'POST', {
    network: 'ethereum',
  })
  const order = await request<Order>(
    page,
    '/orders',
    'POST',
    { quoteId: quote.id, walletId: 'ana-wallet', network: 'ethereum' },
    'migration-order',
  )
  await request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 2,
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open('kurio-mock-domain-v2', 1)
        opening.onerror = () => reject(opening.error)
        opening.onsuccess = () => {
          const database = opening.result
          const transaction = database.transaction('state', 'readwrite')
          const store = transaction.objectStore('state')
          const reading = store.get('domain')
          reading.onsuccess = () => {
            const state = reading.result as {
              testAccountVersion?: number
              wallets: Record<string, Wallet[]>
              users: { id: string; name: string }[]
              nfts: { id: string; editions: { available: number }[] }[]
            }
            state.testAccountVersion = 0
            state.wallets.ana = state.wallets.ana!.filter(
              (wallet) => wallet.network === 'ethereum',
            )
            state.users.find((user) => user.id === 'ana')!.name =
              'Ana preservada'
            state.nfts.find(
              (nft) => nft.id === 'emerald-ape',
            )!.editions[0]!.available = 17
            store.put(state, 'domain')
          }
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
  )
  expect((await request<User>(page, '/profile')).name).toBe('Ana preservada')
  const wallets = await request<Wallet[]>(page, '/wallets')
  expect(wallets.map((wallet) => wallet.network).sort()).toEqual([
    'ethereum',
    'polygon',
    'solana',
  ])
  expect(wallets.filter((wallet) => wallet.isDefault)).toHaveLength(1)
  expect((await request<Cart>(page, '/cart')).items[0]!.quantity).toBe(2)
  expect(
    (
      await request<{ editions: { available: number }[] }>(
        page,
        '/nfts/emerald-ape',
      )
    ).editions[0]!.available,
  ).toBe(17)
  const persisted = (await request<Order[]>(page, '/orders'))[0]!
  expect(persisted.id).toBe(order.id)
  expect(persisted.snapshot).toEqual(order.snapshot)
  const polygon = wallets.find((wallet) => wallet.network === 'polygon')!
  await request(page, `/wallets/${polygon.id}`, 'PATCH', {
    label: 'Polygon personalizada',
    version: polygon.version,
  })
  await page.reload()
  const after = await request<Wallet[]>(page, '/wallets')
  expect(after).toHaveLength(3)
  expect(after.find((wallet) => wallet.id === polygon.id)!.label).toBe(
    'Polygon personalizada',
  )
})

test('páginas não exibem avisos de demonstração e perfil não expõe Biografia', async ({
  page,
}) => {
  await request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 1,
  })
  for (const path of [
    '/',
    '/nfts/emerald-ape',
    '/profile',
    '/wallets',
    '/cart',
    '/checkout',
    '/login',
    '/register',
  ]) {
    await page.goto(path)
    await expect(page.locator('#main-content')).not.toBeEmpty()
    await expect(page.locator('body')).not.toContainText(
      /demonstração|demonstrativ|simulaç|simulad|fictícios/i,
    )
    if (path === '/profile')
      await expect(page.getByText('Biografia', { exact: true })).toHaveCount(0)
  }
})

for (const network of ['ethereum', 'polygon', 'solana'] as const)
  test(`Ana compra em ${network} sem cadastrar carteira`, async ({ page }) => {
    const wallets = await request<Wallet[]>(page, '/wallets')
    const wallet = wallets.find((wallet) => wallet.network === network)!
    expect(wallet).toBeDefined()
    expect(wallet.email).toBe('ana@kurio.demo')
    expect(wallet.displayName).toBeTruthy()
    expect(wallet.profileName).toBeTruthy()
    expect(wallet.address).toMatch(
      network === 'solana'
        ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
        : /^0x[0-9a-fA-F]{40}$/,
    )
    const catalog = await request<NftList>(page, '/nfts?pageSize=24')
    const nft = catalog.items.find(
      (nft) => nft.network === network && nft.editions[0]!.available,
    )!
    await request(page, '/cart/items', 'POST', {
      nftId: nft.id,
      editionId: nft.editions[0]!.id,
      quantity: 1,
    })
    await page.goto('/checkout')
    await page
      .getByRole('radio', {
        name:
          wallet.provider === 'metamask'
            ? 'MetaMask'
            : wallet.provider === 'coinbase'
              ? 'Coinbase Wallet'
              : 'WalletConnect',
        exact: true,
      })
      .click()
    await page
      .getByRole('dialog', { name: 'Conectar carteira', exact: true })
      .getByRole('button', { name: 'Conectar carteira', exact: true })
      .click()
    await page
      .getByRole('button', {
        name: 'Confirmar compra: revisar valores',
        exact: true,
      })
      .click()
    await page.getByRole('checkbox').check()
    await page
      .getByRole('button', { name: 'Confirmar compra', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Compra confirmada' }),
    ).toBeVisible()
    const orders = await request<Order[]>(page, '/orders')
    expect(orders).toHaveLength(1)
    expect(orders[0]!.network).toBe(network)
    expect(orders[0]!.wallet.id).toBe(wallet.id)
  })
