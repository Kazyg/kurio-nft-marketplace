import { expect, test, type Page } from '@playwright/test'
import type { NftList } from '../src/shared/contracts/marketplace.js'
import { toWei } from '../src/shared/contracts/money.js'
import { resetMocks } from './helpers.js'
import { p4Request } from './phase4-helpers.js'

async function ready(page: Page, url = '/') {
  await page.goto(url)
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await expect(page.getByTestId('realtime-status')).toHaveText(
    'Tempo real conectado',
  )
  await expect(page.locator('.catalog-results')).toHaveAttribute(
    'aria-busy',
    'false',
  )
}
test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
})

test('busca desktop recolhida expande pelo teclado, preserva termo e restaura foco', async ({
  page,
}) => {
  await ready(page)
  const trigger = page.getByRole('button', {
    name: 'Buscar no catálogo',
    exact: true,
  })
  await expect(page.getByLabel('Buscar NFTs', { exact: true })).toHaveCount(0)
  await trigger.focus()
  await page.keyboard.press('Enter')
  const input = page.getByLabel('Buscar NFTs', { exact: true })
  await expect(input).toBeFocused()
  await input.fill('Emerald')
  await expect(page).toHaveURL(/q=Emerald/)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(input).toHaveCount(0)
  await trigger.press('Space')
  await expect(input).toHaveValue('Emerald')
  const result = await p4Request<NftList>(page, '/nfts?q=Emerald')
  await expect(page.getByTestId('catalog-card')).toHaveCount(
    result.items.length,
  )
  for (const nft of result.items)
    await expect(
      page.getByTestId('catalog-card').filter({ hasText: nft.name }),
    ).toBeVisible()
  await page.reload()
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  await expect(input).toHaveValue('Emerald')
})

test('menu usa rota e hash ativos sem marcar destinos não implementados', async ({
  page,
}) => {
  await ready(page)
  const nav = page.getByRole('navigation', { name: 'Principal', exact: true })
  await expect(nav.getByRole('link', { name: 'Início' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(nav.getByRole('link', { name: 'Mercado' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
  await nav.getByRole('link', { name: 'Mercado' }).click()
  await expect(nav.getByRole('link', { name: 'Mercado' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(nav.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.goto('/nfts/emerald-ape')
  await expect(nav.getByRole('link', { name: 'Mercado' })).toHaveAttribute(
    'data-active',
    'true',
  )
  await page.goto('/cart')
  await expect(nav.getByRole('link', { name: 'Mercado' })).toHaveAttribute(
    'data-active',
    'true',
  )
  await expect(nav.getByRole('link', { name: 'Criadores' })).toHaveCount(0)
  await expect(nav.locator('[data-active="true"]')).toHaveCSS(
    'border-bottom-width',
    '3px',
  )
})

for (const width of [390, 1440])
  test(`badge real ancorado com 0, 1, 9 e 12 em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await ready(page)
    for (const quantity of [0, 1, 9, 12]) {
      if (quantity === 1)
        await p4Request(page, '/cart/items', 'POST', {
          nftId: 'emerald-ape',
          editionId: 'emerald-ape-standard',
          quantity: 1,
        })
      if (quantity > 1) {
        const cart = await p4Request<
          import('../src/shared/contracts/marketplace.js').Cart
        >(page, '/cart')
        await p4Request(page, `/cart/items/${cart.items[0]!.id}`, 'PATCH', {
          quantity,
        })
      }
      await page.reload()
      const button = page.getByRole('button', {
        name: `Carrinho, ${quantity} itens`,
        exact: true,
      })
      await expect(button).toBeVisible()
      const glyph = (await button.locator('.cart-glyph').boundingBox())!
      const badge = (await button.locator('.cart-count').boundingBox())!
      expect(badge.y).toBeLessThan(glyph.y)
      expect(badge.x + badge.width).toBeGreaterThan(glyph.x + glyph.width)
      expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(44)
      await expect(button.locator('.cart-count')).toHaveText(String(quantity))
    }
  })

test('paginação e filtros mantêm layout, sidebar e grade durante a atualização', async ({
  page,
}) => {
  await ready(page)
  const nodes = await Promise.all(
    [
      '.site-header',
      '.catalog-sidebar',
      '.filters',
      '.site-footer',
      '.hero',
      '[data-testid="catalog-grid"]',
    ].map((selector) => page.locator(selector).elementHandle()),
  )
  await page.getByTestId('catalog-grid').scrollIntoViewIfNeeded()
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    responseDelays: [
      { path: '/nfts', method: 'GET', delayMs: 1500, remaining: 1 },
    ],
  })
  await page.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(
    page.getByText('Atualizando NFTs…', { exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('catalog-skeleton')).toHaveCount(0)
  for (const node of nodes)
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
  await expect(page.locator('.catalog-results')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await page.getByRole('button', { name: /^Arte digital/ }).click()
  await expect(page).toHaveURL(/category=digital-art/)
  expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  for (const node of nodes.slice(0, 5))
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
  await page.goBack()
  await expect(page).toHaveURL(/page=2/)
})

test('slider de duas alças mantém precisão, limites e só consulta ao aplicar', async ({
  page,
}) => {
  await ready(page)
  const initial = await p4Request<NftList>(page, '/nfts?sort=price-asc')
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nfts')
      requests.push(request.url())
  })
  const min = page.getByRole('slider', {
    name: 'Preço mínimo no slider',
    exact: true,
  })
  const max = page.getByRole('slider', {
    name: 'Preço máximo no slider',
    exact: true,
  })
  await min.focus()
  await page.keyboard.press('ArrowRight')
  await max.focus()
  await page.keyboard.press('ArrowLeft')
  expect(requests).toHaveLength(0)
  const low = await page
    .getByLabel('Preço mínimo em ETH', { exact: true })
    .inputValue()
  const high = await page
    .getByLabel('Preço máximo em ETH', { exact: true })
    .inputValue()
  expect(toWei(low)).toBeGreaterThan(0n)
  expect(toWei(low)).toBeLessThanOrEqual(toWei(high))
  expect(toWei(high)).toBeLessThan(toWei(initial.priceRange.maxEth))
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page).toHaveURL(/minPrice=/)
  expect(new URL(page.url()).searchParams.get('maxPrice')).toBe(high)
  await page.reload()
  await expect(
    page.getByLabel('Preço mínimo em ETH', { exact: true }),
  ).toHaveValue(low)
  await min.focus()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  expect(
    toWei(
      await page
        .getByLabel('Preço mínimo em ETH', { exact: true })
        .inputValue(),
    ),
  ).toBeLessThanOrEqual(
    toWei(
      await page
        .getByLabel('Preço máximo em ETH', { exact: true })
        .inputValue(),
    ),
  )
  await page
    .getByLabel('Preço mínimo em ETH', { exact: true })
    .fill('0.000000000000000001')
  await page
    .getByLabel('Preço máximo em ETH', { exact: true })
    .fill('1.190000000000000001')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page).toHaveURL(/minPrice=0.000000000000000001/)
  expect(new URL(page.url()).searchParams.get('maxPrice')).toBe(
    '1.190000000000000001',
  )
  await page.getByLabel('Preço mínimo em ETH', { exact: true }).fill('3')
  await page.getByLabel('Preço máximo em ETH', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'mínimo não pode ultrapassar',
  )
  await page.locator('.filters > .clear-filters').click()
  await expect(
    page.getByLabel('Preço mínimo em ETH', { exact: true }),
  ).toHaveValue('')
  await expect(
    page.getByLabel('Preço máximo em ETH', { exact: true }),
  ).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('slider mobile aplica faixa, restaura valores e devolve foco ao fechar filtros', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await ready(page)
  const trigger = page.getByRole('button', {
    name: 'Abrir filtros',
    exact: true,
  })
  await trigger.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Filtrar NFTs' })
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole('slider', { name: 'Preço mínimo no slider' })
    .press('ArrowRight')
  await dialog
    .getByRole('slider', { name: 'Preço máximo no slider' })
    .press('ArrowLeft')
  const low = await dialog
    .getByLabel('Preço mínimo em ETH', { exact: true })
    .inputValue()
  await dialog.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('minPrice'))
    .toBe(low)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.reload()
  await page.getByRole('button', { name: 'Abrir filtros', exact: true }).click()
  await expect(
    dialog.getByLabel('Preço mínimo em ETH', { exact: true }),
  ).toHaveValue(low)
})

test('busca rápida cancela ou descarta resposta antiga sem substituir a busca atual', async ({
  page,
}) => {
  await ready(page)
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  await p4Request(page, '/__mock/scenario', 'PATCH', {
    responseDelays: [
      { path: '/nfts', method: 'GET', delayMs: 1500, remaining: 1 },
    ],
  })
  const requested = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/nfts' &&
      new URL(request.url()).searchParams.get('q') === 'Emerald',
  )
  const settled = Promise.race([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/nfts' &&
        new URL(response.url()).searchParams.get('q') === 'Emerald',
    ),
    page.waitForEvent(
      'requestfailed',
      (request) =>
        new URL(request.url()).pathname === '/api/nfts' &&
        new URL(request.url()).searchParams.get('q') === 'Emerald',
    ),
  ])
  const input = page.getByLabel('Buscar NFTs', { exact: true })
  await input.fill('Emerald')
  await requested
  await input.fill('Sage')
  await settled
  await expect(page.locator('.catalog-results')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  const result = await p4Request<NftList>(page, '/nfts?q=Sage')
  await expect(page.getByTestId('catalog-card')).toHaveCount(
    result.items.length,
  )
  for (const nft of result.items)
    await expect(
      page.getByTestId('catalog-card').filter({ hasText: nft.name }),
    ).toBeVisible()
  await expect(input).toHaveValue('Sage')
  await expect(page).toHaveURL(/q=Sage/)
})

test('teto global reage a nft.updated, expande máximo e preserva escolha explícita', async ({
  page,
}) => {
  await ready(page, '/?q=Emerald')
  const initial = await p4Request<NftList>(
    page,
    '/nfts?pageSize=24&sort=price-asc',
  )
  const last = await p4Request<NftList>(
    page,
    '/nfts?pageSize=24&sort=price-asc&page=2',
  )
  const globalMax = [...initial.items, ...last.items].reduce(
    (highest, nft) =>
      toWei(nft.priceEth) > highest ? toWei(nft.priceEth) : highest,
    0n,
  )
  expect(toWei(initial.priceRange.maxEth)).toBe(globalMax)
  const maximum = page.getByLabel('Preço máximo em ETH', { exact: true })
  await maximum.fill(initial.priceRange.maxEth)
  const before = Number(
    await page.getByTestId('realtime-status').getAttribute('data-events'),
  )
  await p4Request(page, '/__mock/nfts/golden-signal', 'PATCH', {
    priceEth: '99.000000000000000001',
  })
  await expect(page.getByTestId('price-range-limit')).toHaveText(
    'De 0 até 99.000000000000000001 ETH',
  )
  await expect(maximum).toHaveValue('99.000000000000000001')
  expect(
    Number(
      await page.getByTestId('realtime-status').getAttribute('data-events'),
    ),
  ).toBeGreaterThan(before)
  await maximum.fill('2')
  await p4Request(page, '/__mock/nfts/golden-signal', 'PATCH', {
    priceEth: '120',
  })
  await expect(page.getByTestId('price-range-limit')).toHaveText(
    'De 0 até 120 ETH',
  )
  await expect(maximum).toHaveValue('2')
  await page.getByLabel('Preço mínimo em ETH', { exact: true }).fill('90')
  await maximum.fill('120')
  await p4Request(page, '/__mock/nfts/golden-signal', 'PATCH', {
    priceEth: '0.5',
  })
  await expect(page.getByTestId('price-range-limit')).not.toContainText(
    '120 ETH',
  )
  const low = await page
    .getByLabel('Preço mínimo em ETH', { exact: true })
    .inputValue()
  const high = await maximum.inputValue()
  expect(toWei(low)).toBeGreaterThanOrEqual(0n)
  expect(toWei(low)).toBeLessThanOrEqual(toWei(high))
})

test('rodapé oferece coleções reais, newsletter honesta e redes com nomes acessíveis', async ({
  page,
}) => {
  await ready(page, '/?page=2')
  const footer = page.locator('.site-footer')
  for (const [label, category] of [
    ['Arte digital', 'digital-art'],
    ['Fotografia', 'photography'],
    ['Música', 'music'],
    ['Arte 3D', '3d'],
    ['Utilidade', 'utility'],
  ]) {
    await footer.getByRole('link', { name: label, exact: true }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('category'))
      .toBe(category)
    expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  }
  await page.reload()
  await expect(page.getByTestId('catalog-card').first()).toBeVisible()
  expect(new URL(page.url()).searchParams.get('category')).toBe('utility')
  await page.goBack()
  expect(new URL(page.url()).searchParams.get('category')).toBe('3d')
  const input = footer.getByLabel('E-mail da newsletter')
  await footer.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await input.fill('inválido')
  await footer.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(footer).toContainText('Informe um e-mail válido.')
  await input.fill('colecionador@example.com')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  await expect(footer).toContainText('O e-mail foi enviado.')
  for (const label of [
    'Facebook',
    'Instagram',
    'X (Twitter)',
    'LinkedIn',
    'YouTube',
  ]) {
    const link = footer.getByRole('link', { name: label, exact: true })
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(new URL((await link.getAttribute('href'))!).protocol).toBe('https:')
    await link.focus()
    await expect(link).toBeFocused()
  }
  const profile = footer.getByRole('link', { name: 'Meu perfil', exact: true })
  const orders = footer.getByRole('link', { name: 'Pedidos', exact: true })
  expect(
    await profile.evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe(await orders.evaluate((element) => getComputedStyle(element).fontSize))
  expect(
    await profile.evaluate((element) => getComputedStyle(element).fontWeight),
  ).toBe(
    await orders.evaluate((element) => getComputedStyle(element).fontWeight),
  )
})

test('Home sem indicador permanente preserva telemetria e reconcilia desconexão real', async ({
  page,
}) => {
  await page.clock.install()
  await ready(page)
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await expect(page.locator('aside.realtime-indicator')).toHaveCount(0)
  const disconnected = page.getByTestId('realtime-notice')
  await p4Request(page, '/__mock/realtime', 'POST', { action: 'disconnect' })
  await expect(disconnected).toHaveClass('realtime-indicator')
  await expect(page.getByTestId('realtime-status')).toContainText(
    'desconectado',
  )
  await page.clock.resume()
  await expect(page.getByTestId('realtime-status')).toHaveText(
    'Tempo real conectado',
  )
  await expect(page.locator('aside.realtime-indicator')).toHaveCount(0)
  await page.goto('/diagnostics')
  await expect(page.locator('aside.realtime-indicator')).toBeVisible()
  await expect(page.getByTestId('socket-status')).toHaveText(
    'Socket.IO conectado',
  )
})

for (const width of [390, 414, 768, 1024, 1280, 1440, 360, 720]) {
  test(`Home sem overflow e com rodapé utilizável em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await ready(page)
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await page.locator('.site-footer').scrollIntoViewIfNeeded()
    await expect(page.getByLabel('E-mail da newsletter')).toBeVisible()
    if (width === 390 || width === 1440) {
      await page.locator('.journal').scrollIntoViewIfNeeded()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          [
            ...document.querySelectorAll<HTMLImageElement>('.marketplace img'),
          ].map((img) => {
            img.loading = 'eager'
            return img.decode()
          }),
        )
        scrollTo(0, 0)
      })
      await page.screenshot({
        path: test.info().outputPath(`home-${width}.png`),
        fullPage: true,
      })
    }
    const marketplace = await page.locator('.marketplace').boundingBox()
    expect(marketplace!.width).toBeLessThanOrEqual(width)
  })
}

test('container continua limitado e centralizado em desktop extremamente largo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 5760, height: 1800 })
  await ready(page)
  const box = (await page.locator('.marketplace').boundingBox())!
  expect(box.width).toBe(1440)
  expect(box.x).toBe((5760 - 1440) / 2)
  await expect(page.locator('.marketplace')).toHaveCSS('transform', 'none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    5760,
  )
})
