import { expect, test } from '@playwright/test'
import type { Nft, NftList } from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

test.beforeEach(async ({ page }) => resetMocks(page))

test('catálogo é carregado pelo Service Worker e abre o detalhe', async ({
  page,
}) => {
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/nfts',
  )
  await page.goto('/')
  const response = await responsePromise
  expect(response.fromServiceWorker()).toBe(true)
  const catalog = (await response.json()) as NftList
  await expect(page.getByTestId('catalog-card')).toHaveCount(
    catalog.items.length,
  )
  const item = catalog.items[0]!
  await page
    .getByTestId('catalog-card')
    .filter({ hasText: item.name })
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`/nfts/${item.id}`))
  await expect(
    page.getByRole('heading', { name: item.name, exact: true }),
  ).toBeVisible()
})

test('busca e filtros combinados refletem a resposta REST e persistem após refresh', async ({
  page,
}) => {
  const initial = await mockRequest<NftList>(page, '/nfts')
  const item = initial.items[0]!
  const category = initial.facets.categories.find(
    (facet) => facet.value === item.category,
  )!
  const network = initial.facets.networks.find(
    (facet) => facet.value === item.network,
  )!
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  await page.getByLabel('Buscar NFTs', { exact: true }).fill(item.name)
  await expect(page).toHaveURL(
    new RegExp(
      `q=${encodeURIComponent(item.name).replace(/%20/g, '(?:%20|\\+)')}`,
    ),
  )
  await page
    .getByRole('button', { name: new RegExp(`^${category.label}`) })
    .click()
  await page
    .getByRole('button', { name: new RegExp(`^${network.label}`) })
    .click()
  await page
    .getByLabel('Preço mínimo em ETH', { exact: true })
    .fill(item.priceEth)
  await page
    .getByLabel('Preço máximo em ETH', { exact: true })
    .fill(item.priceEth)
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByTestId('catalog-card')).toHaveCount(1)
  await expect(page.getByTestId('catalog-card')).toContainText(item.name)
  const url = new URL(page.url())
  expect(url.searchParams.get('category')).toBe(item.category)
  expect(url.searchParams.get('network')).toBe(item.network)
  expect(url.searchParams.get('minPrice')).toBe(item.priceEth)
  expect(url.searchParams.get('maxPrice')).toBe(item.priceEth)
  await page.reload()
  await page
    .getByRole('button', { name: 'Buscar no catálogo', exact: true })
    .click()
  await expect(page.getByLabel('Buscar NFTs', { exact: true })).toHaveValue(
    item.name,
  )
  await expect(page.getByTestId('catalog-card')).toHaveCount(1)
})

test('ordenação e paginação sobrevivem ao histórico e ao refresh', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Ordenar por', { exact: true })
    .selectOption('price-asc')
  await expect(page).toHaveURL(/sort=price-asc/)
  await page.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  const secondPage = page.url()
  await page.reload()
  await expect(page.getByLabel('Ordenar por', { exact: true })).toHaveValue(
    'price-asc',
  )
  const expected = await mockRequest<NftList>(
    page,
    '/nfts?sort=price-asc&page=2',
  )
  await expect(page.getByTestId('catalog-card')).toHaveCount(
    expected.items.length,
  )
  for (const item of expected.items)
    await expect(
      page.getByTestId('catalog-card').filter({ hasText: item.name }),
    ).toBeVisible()
  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await page.goForward()
  await expect(page).toHaveURL(secondPage)
})

test('busca sem resultados apresenta estado vazio', async ({ page }) => {
  await page.goto('/?q=nenhum-nft-corresponde-a-esta-busca')
  await expect(page.getByTestId('catalog-empty')).toBeVisible()
  await expect(page.getByTestId('catalog-card')).toHaveCount(0)
})

test('detalhe tem acesso direto e respeita o estoque da edição', async ({
  page,
}) => {
  const nft = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  await page.goto(`/nfts/${nft.id}`)
  await expect(
    page.getByRole('heading', { name: nft.name, exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Quantidade', { exact: true })).toHaveAttribute(
    'max',
    String(nft.editions[0]!.available),
  )
  const edition = nft.editions.find((entry) => entry.available > 0)!
  await page.getByRole('radio', { name: edition.label, exact: true }).check()
  const quantity = page.getByLabel('Quantidade', { exact: true })
  await quantity.fill(String(edition.available + 1))
  await expect(quantity).toHaveValue(String(edition.available))
  await expect(
    page.getByRole('button', { name: 'Aumentar quantidade', exact: true }),
  ).toBeDisabled()
  const mutation = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/cart/items' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Comprar', exact: true }).click()
  expect((await mutation).status()).toBe(200)
  const cart = await mockRequest<{ items: { quantity: number }[] }>(
    page,
    '/cart',
  )
  expect(cart.items).toHaveLength(1)
  expect(cart.items[0]?.quantity).toBe(edition.available)
})

test('detalhe inexistente apresenta mensagem de erro', async ({ page }) => {
  await page.goto('/nfts/nft-inexistente')
  await expect(
    page.getByText('NFT não encontrado', { exact: true }),
  ).toBeVisible()
})

test('favorito usa mutation e desfaz a atualização otimista quando a API falha', async ({
  page,
}) => {
  const nft = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  await page.goto(`/nfts/${nft.id}`)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await dialog.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).toBeHidden()
  const favorite = page.getByRole('button', {
    name: `Favoritar ${nft.name}`,
    exact: true,
  })
  await favorite.click()
  const remove = page.getByRole('button', {
    name: `Favoritar ${nft.name}`,
    exact: true,
  })
  await expect(remove).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(
      async () =>
        (await mockRequest<{ nftIds: string[] }>(page, '/favorites')).nftIds,
    )
    .toContain(nft.id)
  await remove.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(
      async () =>
        (await mockRequest<{ nftIds: string[] }>(page, '/favorites')).nftIds,
    )
    .not.toContain(nft.id)
  await scenario(page, {
    latencyMs: 700,
    failures: [
      {
        path: `/favorites/${nft.id}`,
        method: 'PUT',
        status: 503,
        remaining: 1,
      },
    ],
  })
  const failure = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/favorites/${nft.id}` &&
      response.request().method() === 'PUT',
  )
  await favorite.click()
  await expect(remove).toBeVisible()
  expect((await failure).status()).toBe(503)
  await expect(favorite).toBeVisible()
  expect(
    (await mockRequest<{ nftIds: string[] }>(page, '/favorites')).nftIds,
  ).not.toContain(nft.id)
})

test('latência exibe skeleton e falha configurada exibe erro', async ({
  page,
}) => {
  await scenario(page, { latencyMs: 1200 })
  await page.goto('/')
  await expect(page.getByTestId('catalog-skeleton').first()).toBeVisible()
  await expect(page.getByTestId('catalog-card').first()).toBeVisible()
  await page.goto('/diagnostics')
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await scenario(page, {
    latencyMs: 0,
    failures: [{ path: '/nfts', method: 'GET', status: 503, remaining: 2 }],
  })
  await page.goto('/')
  await expect(page.getByTestId('catalog-error')).toBeVisible()
})

for (const width of [390, 768, 1440]) {
  test(`catálogo e detalhe não têm overflow em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const path of ['/', '/nfts/emerald-ape']) {
      await page.goto(path)
      await expect(
        path === '/'
          ? page.getByTestId('catalog-card').first()
          : page.getByRole('heading', { name: /^Emerald Ape/ }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      for (const image of await page.locator('img:visible').all()) {
        await image.scrollIntoViewIfNeeded()
        await expect
          .poll(() =>
            image.evaluate(
              (element) => (element as HTMLImageElement).naturalWidth,
            ),
          )
          .toBeGreaterThan(0)
      }
      await page.evaluate(async () => {
        await document.fonts.ready
        window.scrollTo({ top: 0, behavior: 'instant' })
      })
      await page.screenshot({
        path: test
          .info()
          .outputPath(`${path === '/' ? 'catalog' : 'detail'}-${width}.png`),
        fullPage: true,
      })
    }
  })
}
