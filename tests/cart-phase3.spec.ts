import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  NftList,
  Quote,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

async function prepareCart(page: Page) {
  await page.goto('/cart')
  await expect(
    page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
  ).toBeVisible()
  const catalog = await mockRequest<NftList>(page, '/nfts?pageSize=24')
  const nft = catalog.items.find((nft) =>
    nft.editions.some((edition) => edition.available >= 3),
  )!
  const edition = nft.editions.find((edition) => edition.available >= 3)!
  await mockRequest<Cart>(page, '/cart/items', 'POST', {
    nftId: nft.id,
    editionId: edition.id,
    quantity: 1,
  })
  await page.reload()
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  return { nft, edition }
}

test.beforeEach(async ({ page }) => resetMocks(page))

test('carrinho visitante persiste, altera quantidades e remove a última edição', async ({
  page,
}) => {
  const { nft } = await prepareCart(page)
  await page
    .getByLabel(`Aumentar quantidade de ${nft.name}`, { exact: true })
    .click()
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText('2')
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  const quote = await mockRequest<Quote>(page, '/quotes', 'POST', {})
  await expect(page.getByTestId('quote-total')).toHaveText(
    `${quote.snapshot.totalEth} ETH`,
  )
  await page.reload()
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText('2')
  await page
    .getByLabel(`Diminuir quantidade de ${nft.name}`, { exact: true })
    .click()
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText('1')
  await expect(
    page.getByLabel(`Diminuir quantidade de ${nft.name}`, { exact: true }),
  ).toBeDisabled()
  await page.getByLabel(`Remover ${nft.name}`, { exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
  ).toBeVisible()
})

test('cupons válido, inválido e expirado usam valores e erros REST', async ({
  page,
}) => {
  await prepareCart(page)
  const field = page.getByLabel('Código promocional', { exact: true })
  for (const code of ['INVALID', 'EXPIRED']) {
    await field.fill(code)
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.locator('.cart-summary [role="alert"]')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Conectar e finalizar' }),
    ).toBeDisabled()
    await page
      .getByRole('button', { name: 'Remover cupom', exact: true })
      .click()
    await expect(page.getByTestId('quote-status')).toHaveText(
      'Cotação atualizada',
    )
  }
  await field.fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  const quote = await mockRequest<Quote>(page, '/quotes', 'POST', {
    couponCode: 'KURIO10',
  })
  await expect(page.getByTestId('quote-total')).toHaveText(
    `${quote.snapshot.totalEth} ETH`,
  )
  await page.reload()
  await expect(field).toHaveValue('KURIO10')
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
})

test('estoque limita quantidade e falha transitória permite repetir alteração', async ({
  page,
}) => {
  const { nft, edition } = await prepareCart(page)
  const cart = await mockRequest<Cart>(page, '/cart')
  await mockRequest(page, `/cart/items/${cart.items[0]!.id}`, 'PATCH', {
    quantity: edition.available,
  })
  await page.reload()
  await expect(
    page.getByLabel(`Aumentar quantidade de ${nft.name}`, { exact: true }),
  ).toBeDisabled()
  await scenario(page, {
    failures: [
      {
        path: `/cart/items/${cart.items[0]!.id}`,
        method: 'PATCH',
        status: 503,
        remaining: 1,
      },
    ],
  })
  await page
    .getByLabel(`Diminuir quantidade de ${nft.name}`, { exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Tentar alterar novamente' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Tentar alterar novamente' }).click()
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText(String(edition.available - 1))
})

test('cotação expirada bloqueia avanço e pode ser renovada', async ({
  page,
}) => {
  await page.clock.install()
  await scenario(page, { quoteTtlMs: 1500 })
  await prepareCart(page)
  await page.clock.fastForward(2500)
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação indisponível ou desatualizada',
    { timeout: 7000 },
  )
  await expect(
    page.getByRole('button', { name: 'Conectar e finalizar' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Atualizar cotação' }).click()
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
})

test('latência mantém ações duplicadas e avanço bloqueados durante alteração', async ({
  page,
}) => {
  const { nft } = await prepareCart(page)
  await scenario(page, { latencyMs: 900 })
  await page
    .getByLabel(`Aumentar quantidade de ${nft.name}`, { exact: true })
    .click()
  await expect(
    page.getByLabel(`Aumentar quantidade de ${nft.name}`, { exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Conectar e finalizar' }),
  ).toBeDisabled()
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText('2')
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
})

test('checkout exige login e merge preserva visitante sem duplicar ao atualizar', async ({
  page,
}) => {
  const { nft } = await prepareCart(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.goto('/cart')
  await expect(page.getByTestId('cart-item')).toHaveCount(1)
  await expect(
    page.getByLabel(`Quantidade de ${nft.name}`, { exact: true }),
  ).toHaveText('1')
  await page.reload()
  await expect(page.getByTestId('cart-item')).toHaveCount(1)
  const cart = await mockRequest<Cart>(page, '/cart')
  expect(cart.items.filter((item) => item.nftId === nft.id)).toHaveLength(1)
  expect(cart.items[0]!.quantity).toBe(1)
})

for (const width of [390, 768, 1440])
  test(`carrinho responsivo sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await prepareCart(page)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      page.getByRole('link', { name: 'Conectar e finalizar' }),
    ).toBeVisible()
    for (const image of await page.locator('img:visible').all()) {
      await image.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0)
    }
    await page.evaluate(async () => {
      await document.fonts.ready
      window.scrollTo({ top: 0, behavior: 'instant' })
    })
    await page.screenshot({
      path: test.info().outputPath(`cart-${width}.png`),
      fullPage: true,
    })
  })
