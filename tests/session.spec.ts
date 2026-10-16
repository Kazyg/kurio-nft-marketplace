import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  Favorites,
  Nft,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

async function login(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await dialog.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test.beforeEach(async ({ page }) => resetMocks(page))

test('login preserva detalhe, retoma favorito e mescla carrinho de visitante após refresh', async ({
  page,
}) => {
  await scenario(page, { latencyMs: 0 })
  const nft = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  await page.goto(`/nfts/${nft.id}`)
  const added = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/cart/items',
  )
  await page.getByRole('button', { name: 'Comprar', exact: true }).click()
  expect((await added).status()).toBe(200)
  await page
    .getByRole('button', { name: `Favoritar ${nft.name}`, exact: true })
    .click()
  await login(page)
  await expect(page).toHaveURL(new RegExp(`/nfts/${nft.id}$`))
  await expect(
    page.getByRole('button', {
      name: `Favoritar ${nft.name}`,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(async () => (await mockRequest<Favorites>(page, '/favorites')).nftIds)
    .toContain(nft.id)
  const cart = await mockRequest<Cart>(page, '/cart')
  expect(cart.ownerId).toBe('ana')
  expect(cart.items).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: `Favoritar ${nft.name}`,
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(1)
})

test('expiração da sessão volta a solicitar login sem perder o contexto do detalhe', async ({
  page,
}) => {
  await scenario(page, { latencyMs: 0, sessionTtlMs: 1800 })
  const nft = await mockRequest<Nft>(page, '/nfts/emerald-ape')
  await page.goto(`/nfts/${nft.id}`)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await login(page)
  await expect(
    page
      .locator('.site-header')
      .getByRole('button', { name: 'Sair', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Entrar', exact: true }),
  ).toBeVisible({ timeout: 8000 })
  await page
    .getByRole('button', { name: `Favoritar ${nft.name}`, exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Entrar na Kurio' }),
  ).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/nfts/${nft.id}$`))
})
