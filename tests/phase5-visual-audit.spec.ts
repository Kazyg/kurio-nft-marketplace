import { expect, test, type Page } from '@playwright/test'
import type {
  Session,
  Nft,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks, scenario } from './helpers.js'
import { p4Request as request } from './phase4-helpers.js'

async function login(page: Page) {
  const session = await request<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
}
async function addItem(page: Page) {
  await request(page, '/cart/items', 'POST', {
    nftId: 'emerald-ape',
    editionId: 'emerald-ape-standard',
    quantity: 2,
  })
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
}
test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
})

test('menu acompanha a seção visível mesmo com hash de mercado na URL', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Principal', exact: true })
  const home = nav.getByRole('link', { name: 'Início', exact: true })
  const market = nav.getByRole('link', { name: 'Mercado', exact: true })
  await market.click()
  await expect(market).toHaveAttribute('data-active', 'true')
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await expect(home).toHaveAttribute('data-active', 'true')
  await expect(market).toHaveAttribute('data-active', 'false')
  await expect(page).toHaveURL(/#catalog$/)
  await market.click()
  await expect
    .poll(() =>
      page
        .locator('#catalog')
        .evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThanOrEqual(120)
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
  await market.focus()
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      page
        .locator('#catalog')
        .evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThanOrEqual(120)
})

for (const width of [390, 768, 1440]) {
  test(`detalhes: estrelas e avaliações coerentes em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const nft = await request<Nft>(page, '/nfts/emerald-ape')
    await page.goto('/nfts/emerald-ape')
    const rating = page.locator('.product-information .star-rating')
    await expect(rating).toHaveAttribute(
      'aria-label',
      `${nft.rating.toLocaleString('pt-BR')} de 5 estrelas`,
    )
    await expect(rating.locator('.star-cell')).toHaveCount(5)
    await expect(rating.locator('.star-cell:visible')).toHaveCount(5)
    if (width >= 1024) {
      const fills = await rating
        .locator('.star-fill')
        .evaluateAll((nodes) =>
          nodes.map((node) => parseFloat((node as HTMLElement).style.width)),
        )
      fills.forEach((fill, index) =>
        expect(fill).toBeCloseTo(
          Math.min(1, Math.max(0, nft.rating - index)) * 100,
          5,
        ),
      )
      const quantity = (await page.locator('.quantity-control').boundingBox())!
      const buy = (await page
        .getByRole('button', { name: 'Comprar', exact: true })
        .boundingBox())!
      expect(buy.x - quantity.x - quantity.width).toBeGreaterThanOrEqual(48)
    } else {
      await expect(page.locator('.buy-actions .favorite-button')).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: 'Ir para o carrinho', exact: true }),
      ).toBeVisible()
    }
    await page
      .getByRole('tab', { name: /Avaliações de colecionadores/ })
      .click()
    await expect(page.locator('.collector-rating')).toHaveCount(3)
    for (const row of await page.locator('.collector-rating').all()) {
      await expect(row.getByRole('img')).toBeVisible()
      await expect(row).toContainText('/ 5')
      const star = row.locator('.rating-star > img').first()
      expect((await star.boundingBox())!.width).toBeCloseTo(12.5017, 1)
      expect((await star.boundingBox())!.height).toBeCloseTo(11.8758, 1)
    }
    await noOverflow(page)
  })

  test(`pagamento: ENS e seleção explícita de carteira em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await addItem(page)
    await page.goto('/checkout')
    if (width < 768)
      await page.locator('#checkout-wallet-details > summary').click()
    await expect(page.locator('.checkout-ens > span')).toHaveText('.eth')
    await expect(page.getByLabel('Carteira cadastrada')).toBeHidden()
    const toggle = page.getByRole('switch', { name: 'Usar outra carteira?' })
    await toggle.focus()
    await page.keyboard.press('Space')
    await expect(toggle).toBeChecked()
    await expect(page.getByLabel('Carteira cadastrada')).toBeVisible()
    const wallets = await request<Wallet[]>(page, '/wallets')
    await expect(page.getByLabel('Carteira cadastrada')).toHaveValue(
      wallets.find((wallet) => wallet.isDefault)!.id,
    )
    await expect(
      page.getByRole('link', { name: 'Gerenciar carteiras', exact: true }),
    ).toBeVisible()
    await page.keyboard.press('Space')
    await expect(toggle).not.toBeChecked()
    await noOverflow(page)
  })

  test(`conta mantém o mesmo padrão em interesse e atividade em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await request(page, '/favorites/emerald-ape', 'PUT')
    for (const path of ['/favorites', '/orders']) {
      await page.goto(path)
      await expect(
        page.locator('.account-shell > .account-sidebar'),
      ).toBeVisible()
      await expect(page.locator('.account-main h1')).toBeVisible()
      const nav = page.getByRole('navigation', {
        name: 'Conta do colecionador',
        exact: true,
      })
      await expect(
        nav.getByRole('link', {
          name: path === '/favorites' ? 'Lista de interesse' : 'Atividade',
          exact: true,
        }),
      ).toHaveAttribute('aria-current', 'page')
      if (path === '/favorites') {
        const art = (await page
          .locator('.account-nft-grid .nft-art')
          .boundingBox())!
        expect(art.height).toBeCloseTo(art.width, 0)
      }
      await noOverflow(page)
    }
  })

  test(`login usa a superfície do site em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    const input = page.getByLabel('E-mail', { exact: true })
    await input.fill('ana@kurio.demo')
    await expect(input).toHaveCSS('background-color', 'rgb(20, 13, 10)')
    await expect(page.locator('.auth-demo-notice')).toHaveCount(0)
    await input.focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Senha', { exact: true })).toBeFocused()
    await noOverflow(page)
  })
}

for (const width of [390, 768])
  test(`carrinho compacto mantém resumo fixo em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await addItem(page)
    await page.goto('/cart')
    await expect(page.getByTestId('quote-status')).toHaveText(
      'Cotação atualizada',
    )
    const panel = page.locator('.cart-summary')
    await expect(panel).toHaveCSS('position', 'fixed')
    await expect(page.locator('.site-footer')).toBeHidden()
    await expect(page.locator('.cart-related')).toHaveCount(0)
    const heading = (await page.locator('.cart-mobile-heading').boundingBox())!
    expect(heading.y).toBeLessThanOrEqual(24)
    const before = (await panel.boundingBox())!
    await page.evaluate(() =>
      scrollTo(0, document.documentElement.scrollHeight),
    )
    const after = (await panel.boundingBox())!
    expect(after.y).toBeCloseTo(before.y, 0)
    expect(after.y + after.height).toBeCloseTo(800, 0)
    await expect(
      page.getByRole('link', { name: 'Conectar e finalizar', exact: true }),
    ).toBeInViewport()
    await noOverflow(page)
  })

test('carteiras preserva posição da seleção ao adicionar e não duplica a principal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await login(page)
  await page.goto('/wallets')
  const toggle = page.getByLabel('Igual à carteira principal')
  const before = (await toggle.boundingBox())!
  const wallets = await request<Wallet[]>(page, '/wallets')
  await page
    .getByRole('button', { name: 'Adicionar carteira', exact: true })
    .click()
  const after = (await toggle.boundingBox())!
  expect(after.y).toBeCloseTo(before.y, 0)
  await expect(toggle).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Cancelar', exact: true }),
  ).toHaveCount(0)
  await toggle.check()
  await expect(toggle).toBeChecked()
  expect(await request<Wallet[]>(page, '/wallets')).toHaveLength(wallets.length)
})

test('perfil oferece apenas Salvar para dados e senha com visibilidade individual', async ({
  page,
}) => {
  await login(page)
  await page.goto('/profile')
  await expect(
    page.getByRole('button', { name: 'Salvar perfil', exact: true }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Alterar senha', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Mostrar senhas', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('.profile-bio')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Mostrar senha atual', exact: true })
    .click()
  await expect(page.getByLabel('Senha atual', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await expect(page.getByLabel('Nova senha', { exact: true })).toHaveAttribute(
    'type',
    'password',
  )
})
