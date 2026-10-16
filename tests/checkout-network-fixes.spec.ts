import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  Network,
  NftList,
  Order,
  Session,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request as request } from './phase4-helpers.js'

async function setup(page: Page, networks: Network[], account = 'ana') {
  await resetMocks(page)
  await request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
  const session = await request<Session>(page, '/auth/login', 'POST', {
    email: `${account}@kurio.demo`,
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
  const catalog = await request<NftList>(page, '/nfts?pageSize=24')
  for (const network of networks) {
    const nft = catalog.items.find(
      (nft) =>
        nft.network === network &&
        nft.editions.some((edition) => edition.available > 0),
    )!
    await request(page, '/cart/items', 'POST', {
      nftId: nft.id,
      editionId: nft.editions.find((edition) => edition.available > 0)!.id,
      quantity: 1,
    })
  }
}
async function addWallet(
  page: Page,
  network: Network,
  label: string,
  isDefault = false,
) {
  return request<Wallet>(page, '/wallets', 'POST', {
    label,
    network,
    provider: 'metamask',
    address: `0x${'b'.repeat(40)}`,
    isDefault,
  })
}
async function buy(page: Page) {
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
  await page
    .getByRole('button', { name: 'Conectar carteira', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Revise antes de enviar' }),
  ).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  const sent = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/orders') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  const response = await sent
  expect(response.fromServiceWorker()).toBe(true)
  expect(response.ok()).toBe(true)
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  return (await response.json()) as Order
}

for (const network of ['ethereum', 'polygon'] as const)
  test(`checkout ${network} escolhe carteira compatível e chega ao recibo`, async ({
    page,
  }) => {
    await setup(page, [network])
    const polygon = await addWallet(page, 'polygon', 'Principal Polygon', true)
    await page.goto('/checkout')
    await expect(page.getByLabel('Rede', { exact: true })).toHaveValue(network)
    const selected = page.getByLabel('Carteira cadastrada')
    const wallets = await request<Wallet[]>(page, '/wallets')
    const wallet = wallets.find(
      (wallet) =>
        wallet.id ===
        (network === 'polygon'
          ? polygon.id
          : wallets.find((wallet) => wallet.network === 'ethereum')!.id),
    )!
    await expect(selected).toHaveValue(wallet.id)
    await expect(selected.locator('option')).toHaveCount(
      wallets.filter((entry) => entry.network === network).length,
    )
    const order = await buy(page)
    expect(order.network).toBe(network)
    expect(order.wallet.id).toBe(wallet.id)
    expect((await request<Cart>(page, '/cart')).items).toHaveLength(0)
    await page.reload()
    await expect(
      page.getByRole('dialog', { name: 'Compra confirmada' }),
    ).toContainText(order.id)
    expect(await request<Order[]>(page, '/orders')).toHaveLength(1)
  })

test('carrinho multirrede exige escolha explícita e preserva os demais NFTs', async ({
  page,
}) => {
  await setup(page, ['ethereum', 'polygon'])
  await addWallet(page, 'polygon', 'Polygon')
  await page.goto('/checkout')
  await expect(page.getByLabel('Rede', { exact: true })).toHaveValue('')
  await expect(
    page.getByText(/Seu carrinho contém Ethereum, Polygon/),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    }),
  ).toBeDisabled()
  await page.getByLabel('Rede', { exact: true }).selectOption('ethereum')
  const order = await buy(page)
  expect(order.network).toBe('ethereum')
  expect(order.snapshot.lines).toHaveLength(1)
  const cart = await request<Cart>(page, '/cart')
  expect(cart.items).toHaveLength(1)
  expect(cart.items[0]!.nft.network).toBe('polygon')
  await page.getByRole('button', { name: 'Fechar recibo', exact: true }).click()
  await page
    .getByRole('button', { name: 'Iniciar nova compra', exact: true })
    .click()
  await expect(page.getByLabel('Rede', { exact: true })).toHaveValue('polygon')
  expect((await buy(page)).network).toBe('polygon')
  expect((await request<Cart>(page, '/cart')).items).toHaveLength(0)
  expect(await request<Order[]>(page, '/orders')).toHaveLength(2)
})

test('sem carteira compatível orienta cadastro e recupera seleção após salvar', async ({
  page,
}) => {
  await setup(page, ['polygon'], 'bruno')
  await page.goto('/checkout')
  await expect(
    page.getByText('Cadastre uma carteira Polygon para continuar.'),
  ).toBeVisible()
  await expect(page.getByLabel('Carteira cadastrada')).toBeDisabled()
  await expect(
    page.getByRole('radio', { name: 'MetaMask', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('link', { name: 'Gerenciar carteiras', exact: true }),
  ).toBeVisible()
  const wallet = await addWallet(page, 'polygon', 'Compatível')
  await page.reload()
  await expect(page.getByLabel('Carteira cadastrada')).toHaveValue(wallet.id)
  await buy(page)
})

test('troca de carteira descarta conexão e revisão e envia carteira atual', async ({
  page,
}) => {
  await setup(page, ['ethereum'])
  const second = await addWallet(page, 'ethereum', 'Reserva Ethereum')
  await page.goto('/checkout')
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
  await page
    .getByRole('button', { name: 'Conectar carteira', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Confirmar compra', exact: true }),
  ).toBeEnabled()
  expect(await request<Order[]>(page, '/orders')).toHaveLength(0)
  await page.getByRole('switch', { name: 'Usar outra carteira?' }).check()
  await page.getByLabel('Carteira cadastrada').selectOption(second.id)
  await expect(
    page.getByRole('heading', { name: 'Revise antes de enviar' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    }),
  ).toBeDisabled()
  expect(await request<Order[]>(page, '/orders')).toHaveLength(0)
  expect((await buy(page)).wallet.id).toBe(second.id)
})

for (const width of [375, 390, 414, 768, 1440])
  test(`checkout Figma ${width}px sem overflow, assets locais e compra`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 896 })
    await setup(page, ['ethereum'])
    await addWallet(page, 'ethereum', 'Reserva')
    await page.goto('/checkout')
    await expect(
      page.getByRole('radio', { name: 'MetaMask', exact: true }),
    ).toBeVisible()
    if (width < 768) {
      await expect(
        page.getByRole('heading', { name: 'Pagamento com carteira' }),
      ).toBeVisible()
      await expect(page.locator('.site-header')).toBeHidden()
      await expect(page.locator('.mobile-nav')).toBeHidden()
      await expect(page.locator('.checkout-wallet-card')).toHaveCount(2)
      expect(
        (await page.locator('.checkout-wallet-card').first().boundingBox())!
          .height,
      ).toBe(93)
      expect(
        (await page.locator('.checkout-provider').first().boundingBox())!
          .height,
      ).toBe(65)
    } else {
      expect(
        (await page.locator('.checkout-provider').first().boundingBox())!
          .height,
      ).toBe(45)
    }
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images].map((image) => {
          image.loading = 'eager'
          return image.decode()
        }),
      )
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(
      await page
        .locator('.checkout-presentation img')
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`checkout-figma-${width}.png`),
      fullPage: true,
    })
    if (width < 768) {
      await page
        .getByRole('button', { name: 'Trocar carteira', exact: true })
        .click()
      await expect(page.getByLabel('Carteira cadastrada')).toBeFocused()
    }
    await page
      .getByLabel('Observação do colecionador (opcional)')
      .fill('Entregar na carteira selecionada.')
    const order = await buy(page)
    expect(order.collector.note).toBe('Entregar na carteira selecionada.')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  })

for (const networks of [['polygon'], ['ethereum', 'polygon']] as Network[][])
  test(`mobile orienta seleção ${networks.join('+')} sem ocultar o motivo do bloqueio`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 896 })
    await setup(page, networks, networks.length === 1 ? 'bruno' : 'ana')
    if (networks.length > 1) await addWallet(page, 'polygon', 'Polygon')
    await page.goto('/checkout')
    if (networks.length > 1)
      await expect(
        page.getByText(/Seu carrinho contém Ethereum, Polygon/),
      ).toBeVisible()
    else
      await expect(
        page.getByText('Cadastre uma carteira Polygon para continuar.'),
      ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Confirmar compra',
        exact: true,
      }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Trocar carteira', exact: true })
      .click()
    await expect(page.getByLabel('Rede', { exact: true })).toBeVisible()
    if (networks.length > 1) {
      await page.getByLabel('Rede', { exact: true }).selectOption('polygon')
      await expect(page.getByLabel('Carteira cadastrada')).toBeEnabled()
      expect((await buy(page)).network).toBe('polygon')
      expect(
        (await request<Cart>(page, '/cart')).items.map(
          (item) => item.nft.network,
        ),
      ).toEqual(['ethereum'])
    } else
      await expect(
        page.getByRole('link', { name: 'Gerenciar carteiras', exact: true }),
      ).toBeVisible()
  })
