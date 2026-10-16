import { expect, test } from '@playwright/test'
import { resetMocks } from './helpers.js'
import { p4Request } from './phase4-helpers.js'

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
})

test('detalhe apresenta cinco miniaturas, compartilhamento, direitos e comentários ilustrativos', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/nfts/emerald-ape')
  await expect(page.locator('.gallery-thumbnails button')).toHaveCount(5)
  await page
    .getByRole('button', { name: 'Imagem 5 de Emerald Ape #042', exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Imagem 5 de Emerald Ape #042',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.main-product-image img')).toHaveAttribute(
    'src',
    '/assets/nfts/responsive/emerald-ape-1254.webp',
  )
  for (const width of [160, 320, 640, 960, 1254])
    await expect(page.locator('.main-product-image img')).toHaveAttribute(
      'srcset',
      new RegExp(`emerald-ape-${width}\\.webp ${width}w`),
    )
  await expect
    .poll(() =>
      page
        .locator('.main-product-image img')
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0)
  await expect(page.locator('.buy-actions').getByRole('button')).toHaveCount(2)
  await expect(
    page
      .locator('.buy-actions')
      .getByRole('button', { name: 'Comprar', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.buy-actions .lucide-heart')).toHaveCount(1)
  await expect(page.locator('.buy-actions .lucide-shopping-cart')).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }),
  ).toHaveCount(0)
  const share = page.getByRole('region', {
    name: 'Compartilhar este NFT',
    exact: true,
  })
  await expect(share).toBeVisible()
  await share.getByRole('button', { name: 'Copiar link deste NFT' }).click()
  await expect(share).toContainText('Link copiado.')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  )
  for (const link of [
    'Compartilhar NFT no X',
    'Compartilhar NFT no LinkedIn',
  ]) {
    await expect(share.getByRole('link', { name: link })).toHaveAttribute(
      'target',
      '_blank',
    )
    await expect(share.getByRole('link', { name: link })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  }
  await expect(
    page.getByRole('heading', { name: 'Direitos autorais:' }),
  ).toBeVisible()
  await expect(page.getByRole('tabpanel')).toContainText(
    'Direitos autorais do criador: 5%',
  )
  await expect(page.getByRole('tabpanel')).toContainText(
    '0x7a420000000000000000000000000000000019e8',
  )
  await page.getByRole('tab', { name: /Avaliações de colecionadores/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Comentários dos colecionadores' }),
  ).toBeVisible()
  await expect(page.locator('.collector-reviews li')).toHaveCount(3)
  await expect(page.locator('.collector-reviews')).toContainText('Marina Costa')
  await expect(page.getByRole('tabpanel')).not.toContainText(
    'Comentários fictícios',
  )
})

for (const [width, height] of [
  [390, 844],
  [1440, 900],
  [1024, 500],
  [390, 360],
]) {
  test(`zoom cabe sem scrollbar em ${width}x${height} e restaura foco/scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/nfts/emerald-ape')
    const trigger = page.getByRole('button', {
      name: 'Ampliar imagem de Emerald Ape #042',
      exact: true,
    })
    await expect(trigger).toBeVisible()
    const overflow = await page.evaluate(
      () => getComputedStyle(document.body).overflow,
    )
    await trigger.click()
    const dialog = page.getByRole('dialog', {
      name: 'Emerald Ape #042',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    await expect
      .poll(() =>
        dialog.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true)
    const frame = (await dialog.boundingBox())!
    const image = (await dialog.locator('img').boundingBox())!
    expect(frame.x).toBeGreaterThanOrEqual(0)
    expect(frame.y).toBeGreaterThanOrEqual(0)
    expect(frame.x + frame.width).toBeLessThanOrEqual(width)
    expect(frame.y + frame.height).toBeLessThanOrEqual(height)
    expect(image.y + image.height).toBeLessThan(frame.y + frame.height)
    await expect(dialog.locator('img')).toHaveCSS('object-fit', 'contain')
    expect(
      await page.evaluate(() =>
        document.body.getAttribute('data-scroll-locked'),
      ),
    ).not.toBeNull()
    if (height >= 844)
      await page.screenshot({
        path: test.info().outputPath(`zoom-${width}.png`),
      })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe(overflow)
    await expect
      .poll(() =>
        page.evaluate(() => document.body.getAttribute('data-scroll-locked')),
      )
      .toBeNull()
  })
}

test('busca ativa expande na mesma linha do header e conserva o termo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  const input = page.getByLabel('Buscar NFTs', { exact: true })
  await expect(input).toBeFocused()
  await expect(page.locator('.header-search')).toHaveClass(/is-expanded/)
  await expect(page.locator('.header-search-field')).toHaveCSS(
    'position',
    'static',
  )
  const header = (await page.locator('.site-header').boundingBox())!
  const field = (await input.boundingBox())!
  expect(field.y).toBeGreaterThanOrEqual(header.y)
  expect(field.y + field.height).toBeLessThanOrEqual(header.y + header.height)
  await input.fill('Emerald')
  await expect(page).toHaveURL(/q=Emerald/)
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  await expect(input).toHaveValue('Emerald')
  await page.screenshot({ path: test.info().outputPath('header-expanded.png') })
})

test('Home reserva o hero no carregamento independente de conteúdo mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    responseDelays: [
      { path: '/catalog/content', method: 'GET', delayMs: 2500, remaining: 2 },
    ],
  })
  await page.goto('/')
  const placeholder = page.getByRole('region', { name: 'Carregando destaques' })
  await expect(placeholder).toBeVisible()
  const before = (await placeholder.boundingBox())!
  await expect(page.locator('.hero:not(.hero-placeholder)')).toBeVisible()
  const after = (await page.locator('.hero').boundingBox())!
  expect(after.height).toBe(before.height)
  expect(after.y).toBe(before.y)
})

for (const width of [390, 768, 1024, 1440])
  test(`detalhe e Home equilibrados sem overflow em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('.hero:not(.hero-placeholder)')).toBeVisible()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width >= 1024) {
      const sidebar = (await page.locator('.catalog-sidebar').boundingBox())!
      const grid = (await page.getByTestId('catalog-grid').boundingBox())!
      expect(Math.abs(sidebar.height - grid.height)).toBeLessThan(300)
    } else expect((await page.locator('.hero').boundingBox())!.height).toBe(180)
    await page.goto('/nfts/emerald-ape')
    await expect(
      page.getByRole('button', { name: 'Comprar', exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 390 || width === 1440) {
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          [
            ...document.querySelectorAll<HTMLImageElement>(
              '.product-detail img',
            ),
          ].map((image) => {
            image.loading = 'eager'
            return image.decode()
          }),
        )
        scrollTo(0, 0)
      })
      await page.screenshot({
        path: test.info().outputPath(`detail-${width}.png`),
        fullPage: true,
      })
    }
  })
