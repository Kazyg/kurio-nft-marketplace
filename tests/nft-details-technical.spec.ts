import { expect, test } from '@playwright/test'
import type {
  Cart,
  Favorites,
  Nft,
  NftList,
  Session,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'
const legacyNftDescription =
  'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.'
const legacyNftDetails =
  'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.'

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
})

for (const width of [390, 768, 1024, 1440])
  test(`ações do detalhe alinhadas e funcionais em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    await page.evaluate(
      (token) => localStorage.setItem('kurio.accessToken', token!),
      session.accessToken,
    )
    await page.goto('/nfts/emerald-ape')
    const buy = page.getByRole('button', { name: 'Comprar', exact: true })
    const favorite =
      width < 1024
        ? page.getByRole('link', { name: 'Ir para o carrinho', exact: true })
        : page.getByRole('button', {
            name: 'Favoritar Emerald Ape #042',
            exact: true,
          })
    await expect(buy).toBeVisible()
    await expect(favorite).toBeVisible()
    const buyBox = (await buy.boundingBox())!
    const favoriteBox = (await favorite.boundingBox())!
    const quantityBox = (await page.locator('.quantity-control').boundingBox())!
    expect(favoriteBox.x).toBeGreaterThanOrEqual(buyBox.x + buyBox.width)
    expect(favoriteBox.y + favoriteBox.height / 2).toBeCloseTo(
      buyBox.y + buyBox.height / 2,
      0,
    )
    if (width >= 1024)
      expect(quantityBox.x + quantityBox.width).toBeLessThan(buyBox.x)
    else
      expect(quantityBox.y + quantityBox.height).toBeLessThanOrEqual(buyBox.y)
    await expect(page.locator('.product-information')).not.toContainText(
      'Rede:',
    )
    await expect(page.locator('.buy-actions .lucide-heart')).toHaveCount(
      width < 1024 ? 0 : 1,
    )
    await page.getByLabel('Aumentar quantidade', { exact: true }).click()
    if (width >= 1024) {
      await favorite.click()
      await expect(
        page.getByRole('button', {
          name: 'Favoritar Emerald Ape #042',
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        (await mockRequest<Favorites>(page, '/favorites')).nftIds,
      ).toContain('emerald-ape')
    }
    await expect(page.getByLabel('Quantidade', { exact: true })).toHaveValue(
      '2',
    )
    await buy.click()
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'NFT adicionado ao carrinho.' }),
    ).toBeVisible()
    const cart = await mockRequest<Cart>(page, '/cart')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({
      nftId: 'emerald-ape',
      editionId: 'emerald-ape-standard',
      quantity: 2,
    })
    if (width < 1024) {
      await favorite.click()
      await expect(page).toHaveURL(/\/cart$/)
      await expect(page.getByTestId('cart-item')).toHaveCount(1)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`detail-actions-${width}.png`),
      fullPage: true,
    })
  })

test('catálogo fornece referências distintas e royalties específicos por NFT', async ({
  page,
}) => {
  const first = await mockRequest<NftList>(page, '/nfts?pageSize=24')
  const second = await mockRequest<NftList>(page, '/nfts?pageSize=24&page=2')
  const nfts = [...first.items, ...second.items]
  expect(new Set(nfts.map((nft) => nft.technical?.contractAddress)).size).toBe(
    nfts.length,
  )
  expect(
    new Set(nfts.map((nft) => nft.technical?.royaltyBasisPoints)).size,
  ).toBeGreaterThan(1)
  for (const nft of nfts) {
    expect(nft.technical).toBeDefined()
    expect(nft.technical!.contractAddress).toMatch(
      nft.network === 'solana'
        ? /^[1-9A-HJ-NP-Za-km-z]{44}$/
        : /^0x[0-9a-f]{40}$/,
    )
    expect(nft.technical!.tokenStandard).toBe(
      nft.network === 'solana' ? 'Metaplex Token Metadata' : 'ERC-1155',
    )
  }
})

for (const id of ['emerald-ape', 'sage-nomad', 'neon-vessel', 'cosmic-bloom'])
  test(`detalhes técnicos refletem o NFT ${id}`, async ({ page }) => {
    const nft = await mockRequest<Nft>(page, `/nfts/${id}`)
    await page.goto(`/nfts/${id}`)
    const panel = page.getByRole('tabpanel')
    await expect(
      panel.getByRole('heading', { name: 'Criador:', exact: true }),
    ).toHaveCount(0)
    await expect(
      panel.getByRole('heading', { name: 'Contrato:', exact: true }),
    ).toBeVisible()
    await expect(panel).toContainText(
      `${nft.network} • ${nft.technical!.networkDescription}`,
    )
    const percent = new Intl.NumberFormat('pt-BR', {
      maximumFractionDigits: 2,
    }).format(nft.technical!.royaltyBasisPoints! / 100)
    await expect(panel).toContainText(
      `Direitos autorais do criador: ${percent}%`,
    )
    await expect(panel).toContainText(nft.technical!.contractAddress)
    await expect(panel).toContainText(nft.technical!.tokenStandard)
    await expect(panel).not.toContainText(
      /demonstração|demonstrativa|fictícios|verificado/i,
    )
    if (nft.network === 'solana')
      await expect(panel).not.toContainText('ERC-721')
  })

test('metadados antigos são completados sem reset de preço, estoque ou carrinho', async ({
  page,
}) => {
  await page.goto('/nfts/emerald-ape')
  await page.getByRole('button', { name: 'Comprar', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'NFT adicionado' }),
  ).toBeVisible()
  const before = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  const cart = await mockRequest<Cart>(page, '/cart')
  await page.evaluate(
    async ({ description, details }) => {
      await navigator.locks.request(
        'kurio-mock-domain',
        () =>
          new Promise<void>((resolve, reject) => {
            const request = indexedDB.open('kurio-mock-domain-v2', 1)
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const db = request.result
              const tx = db.transaction('state', 'readwrite')
              const store = tx.objectStore('state')
              const read = store.get('domain')
              read.onsuccess = () => {
                const state = read.result as { nfts: Nft[] }
                const nft = state.nfts.find(
                  (item) => item.id === 'emerald-ape',
                )!
                delete nft.technical
                nft.description = description
                nft.details = details
                store.put(state, 'domain')
              }
              tx.oncomplete = () => {
                db.close()
                resolve()
              }
              tx.onerror = () => {
                db.close()
                reject(tx.error)
              }
            }
          }),
      )
    },
    { description: legacyNftDescription, details: legacyNftDetails },
  )
  await page.reload()
  await expect(page.getByRole('tabpanel')).toContainText(
    before.technical!.contractAddress,
  )
  const after = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  expect(after.priceEth).toBe(before.priceEth)
  expect(after.editions).toEqual(before.editions)
  expect(after.version).toBe(before.version)
  expect(after.details).not.toBe(legacyNftDetails)
  expect((await mockRequest<Cart>(page, '/cart')).items).toEqual(cart.items)
})
