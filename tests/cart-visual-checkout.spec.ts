import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  NftList,
  Quote,
  Session,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

test.beforeEach(async ({ page }) => resetMocks(page))

async function fillCart(page: Page) {
  await page.goto('/cart')
  await expect(
    page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
  ).toBeVisible()
  const catalog = await mockRequest<NftList>(page, '/nfts?pageSize=24')
  const nfts = catalog.items
    .filter((nft) => nft.editions.some((edition) => edition.available >= 3))
    .slice(0, 3)
  for (const nft of nfts)
    await mockRequest(page, '/cart/items', 'POST', {
      nftId: nft.id,
      editionId: nft.editions.find((edition) => edition.available >= 3)!.id,
      quantity: 2,
    })
  await page.goto('/cart')
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  return nfts
}

async function login(page: Page) {
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

for (const width of [390, 768, 1440])
  test(`carrinho corresponde à estrutura Figma e não transborda em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const nfts = await fillCart(page)
    await expect(
      page.getByText('SELEÇÃO DO COLECIONADOR', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Meu carrinho', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Revise suas edições antes de continuar.', {
        exact: true,
      }),
    ).toHaveCount(0)
    const quote = await mockRequest<Quote>(page, '/quotes', 'POST', {})
    for (const line of quote.snapshot.lines) {
      await expect(
        page.getByLabel(`Total de ${line.name}`, { exact: true }),
      ).toHaveText(`${line.totalEth} ETH`)
      if (width === 1440)
        await expect(
          page.getByLabel(`Preço de ${line.name}`, { exact: true }),
        ).toHaveText(`${line.unitPriceEth} ETH`)
    }
    if (width === 1440) {
      await expect(
        page.getByRole('navigation', { name: 'Caminho da página' }),
      ).toBeVisible()
      await expect(page.locator('.cart-table-heading')).toHaveText(
        'NFTsPreçoEdiçõesTotal',
      )
      const table = (await page.locator('.cart-items').boundingBox())!
      const summary = (await page.locator('.cart-summary').boundingBox())!
      expect(table.width).toBeCloseTo(782, 0)
      expect(summary.width).toBeCloseTo(332, 0)
      expect(summary.x - table.x - table.width).toBeCloseTo(86, 0)
      expect(
        (await page.getByTestId('cart-item').first().boundingBox())!.height,
      ).toBe(70)
    } else {
      await expect(
        page.getByRole('heading', { name: 'Carrinho de NFTs' }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Voltar ao mercado' }),
      ).toBeVisible()
      await expect(page.locator('.cart-table-heading')).toBeHidden()
      expect(
        (await page.getByTestId('cart-item').first().boundingBox())!.height,
      ).toBe(100)
    }
    await expect(page.getByTestId('quote-total')).toHaveText(
      `${quote.snapshot.totalEth} ETH`,
    )
    await expect(page.getByText('Taxa estimada', { exact: true })).toBeVisible()
    if (width === 1440) {
      await expect(
        page.getByRole('heading', { name: 'Colecionadores também viram' }),
      ).toBeVisible()
      await expect(
        page.locator('.cart-related [data-testid="catalog-card"]'),
      ).toHaveCount(15)
      const relatedGeometry = await page
        .locator('.cart-related-rail')
        .evaluate((rail) => {
          const frame = rail.getBoundingClientRect()
          return [...rail.children]
            .filter((card) => card.getBoundingClientRect().left < frame.right)
            .map((card) => ({
              top: card.getBoundingClientRect().top,
              bottom: card.querySelector('.nft-price')!.getBoundingClientRect()
                .bottom,
              railBottom: frame.bottom,
            }))
        })
      for (const card of relatedGeometry) {
        expect(card.top).toBeCloseTo(relatedGeometry[0]!.top, 0)
        expect(card.bottom).toBeLessThanOrEqual(card.railBottom + 1)
      }
    } else {
      await expect(page.locator('.cart-related')).toHaveCount(0)
      await expect(page.locator('.site-footer')).toBeHidden()
      await expect(page.locator('.cart-summary')).toHaveCSS('position', 'fixed')
    }
    const trash = page.getByRole('button', {
      name: `Remover ${nfts[0]!.name}`,
      exact: true,
    })
    await expect(trash.locator('img')).toHaveAttribute(
      'src',
      '/assets/figma/cart-delete.svg',
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 1440)
      await page.locator('.cart-related').scrollIntoViewIfNeeded()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.querySelectorAll<HTMLImageElement>('.cart-page img')]
          .filter((image) => {
            const rect = image.getBoundingClientRect()
            return rect.width > 0 && rect.left < innerWidth && rect.right > 0
          })
          .map((image) => {
            image.loading = 'eager'
            return image.decode()
          }),
      )
      scrollTo(0, 0)
    })
    await page.screenshot({
      path: test.info().outputPath(`cart-figma-${width}.png`),
      fullPage: true,
    })
    await trash.click()
    await expect(page.getByTestId('cart-item')).toHaveCount(2)
  })

test('relacionados têm paginação real e navegam ao NFT correspondente', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await fillCart(page)
  const rail = page.locator('.cart-related-rail')
  await expect(rail.locator('article')).toHaveCount(15)
  await page
    .getByRole('button', { name: 'Ver página 2 dos relacionados', exact: true })
    .click()
  await expect
    .poll(() => rail.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(1000)
  await expect(
    page.getByRole('button', {
      name: 'Ver página 2 dos relacionados',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  const link = rail.locator('.nft-art').nth(5)
  const href = await link.getAttribute('href')
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  await expect(page.locator('.product-title h1')).toBeVisible()
})

for (const width of [390, 1440])
  for (const authenticated of [false, true])
    test(`carrinho → ${authenticated ? 'checkout autenticado' : 'login → checkout'} preserva itens em ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 })
      if (authenticated) {
        const session = await mockRequest<Session>(
          page,
          '/auth/login',
          'POST',
          { email: 'ana@kurio.demo', password: 'Kurio123!' },
        )
        await page.evaluate(
          (token) => localStorage.setItem('kurio.accessToken', token!),
          session.accessToken,
        )
      }
      await fillCart(page)
      const before = await mockRequest<Cart>(page, '/cart')
      await page
        .getByRole('link', { name: 'Conectar e finalizar', exact: true })
        .click()
      if (!authenticated) {
        await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
        await login(page)
      }
      await expect(page).toHaveURL(/\/checkout$/)
      await expect(
        page.getByRole('heading', { name: 'Finalizar compra', exact: true }),
      ).toBeVisible()
      if ((page.viewportSize()?.width || 1440) < 768) {
        await expect(page.getByTestId('checkout-mobile-total')).toBeVisible()
        await page.locator('#checkout-wallet-details > summary').click()
      }
      await expect(page.getByTestId('purchase-total')).toBeVisible()
      const after = await mockRequest<Cart>(page, '/cart')
      expect(
        after.items.map(({ nftId, editionId, quantity }) => ({
          nftId,
          editionId,
          quantity,
        })),
      ).toEqual(
        before.items.map(({ nftId, editionId, quantity }) => ({
          nftId,
          editionId,
          quantity,
        })),
      )
      expect(await mockRequest(page, '/orders')).toEqual([])
      await page.reload()
      if ((page.viewportSize()?.width || 1440) < 768) {
        await expect(page.getByTestId('checkout-mobile-total')).toBeVisible()
        await page.locator('#checkout-wallet-details > summary').click()
      }
      await expect(page.getByTestId('purchase-total')).toBeVisible()
    })

test('cotação vencida explica o bloqueio e atualização permite acessar o pagamento', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))
  await scenario(page, { quoteTtlMs: 1500 })
  await fillCart(page)
  await page.clock.setFixedTime(new Date('2026-10-16T12:00:02.500Z'))
  await expect(
    page.getByRole('button', { name: 'Conectar e finalizar', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText(
      'Sua cotação expirou. Clique em Atualizar cotação para continuar ao pagamento.',
      { exact: true },
    ),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Atualizar cotação', exact: true })
    .click()
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  await page
    .getByRole('link', { name: 'Conectar e finalizar', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
})

test('sessão expirada no carrinho retoma pagamento após login sem perder itens', async ({
  page,
}) => {
  const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
  await fillCart(page)
  const before = await mockRequest<Cart>(page, '/cart')
  await scenario(page, {
    failures: [
      { path: '/auth/session', method: 'GET', status: 401, remaining: 1 },
    ],
  })
  await page
    .getByRole('link', { name: 'Conectar e finalizar', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await login(page)
  await expect(page).toHaveURL(/\/checkout$/)
  if ((page.viewportSize()?.width || 1440) < 768) {
    await expect(page.getByTestId('checkout-mobile-total')).toBeVisible()
    await page.locator('#checkout-wallet-details > summary').click()
  }
  await expect(page.getByTestId('purchase-total')).toBeVisible()
  const after = await mockRequest<Cart>(page, '/cart')
  expect(
    after.items.map((item) => [item.nftId, item.editionId, item.quantity]),
  ).toEqual(
    before.items.map((item) => [item.nftId, item.editionId, item.quantity]),
  )
})
