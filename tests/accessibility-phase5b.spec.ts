import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { Session } from '../src/shared/contracts/marketplace.js'
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
    quantity: 1,
  })
}
async function scan(page: Page, info: TestInfo) {
  await page.evaluate(() => document.fonts.ready)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  await info.attach('axe-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  })
  expect(results.violations).toEqual([])
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

const screens = [
  { path: '/', ready: '[data-testid="catalog-grid"]' },
  { path: '/nfts/emerald-ape', ready: '.product-information' },
  { path: '/cart', ready: '.cart-empty' },
  { path: '/login', ready: '.auth-form' },
  { path: '/register', ready: '.auth-form' },
  { path: '/profile', ready: '#profile-form', auth: true },
  { path: '/wallets', ready: '.wallet-form', auth: true },
  { path: '/favorites', ready: '.account-main', auth: true },
  { path: '/orders', ready: '.account-main', auth: true },
  {
    path: '/checkout',
    ready: '.checkout-presentation',
    auth: true,
    cart: true,
  },
] as const

for (const width of [390, 1440]) {
  for (const screen of screens) {
    test(`axe WCAG: ${screen.path} em ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 })
      if ('auth' in screen) await login(page)
      if ('cart' in screen) await addItem(page)
      await page.goto(screen.path)
      await expect(page.locator(screen.ready).first()).toBeVisible()
      if (screen.path === '/' && width >= 1024)
        await expect(
          page.getByRole('slider', { name: 'Preço mínimo no slider' }),
        ).toBeVisible()
      if (screen.path === '/checkout')
        await expect(page.locator('.checkout-quote-status')).toContainText(
          'Cotação atualizada',
        )
      await scan(page, info)
      await noOverflow(page)
    })
  }
  test(`axe: confirmação real em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    await addItem(page)
    await page.goto('/checkout')
    await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
    await page
      .getByRole('button', { name: 'Conectar carteira', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Revise antes de enviar' }),
    ).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Confirmar compra', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Compra confirmada' }),
    ).toBeVisible()
    await scan(page, info)
    await page.keyboard.press('Escape')
    await expect(page.locator('#purchase-order-details')).toBeFocused()
  })
}

test('teclado: skip link, busca expandida e retorno de foco', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Ir para conteúdo' }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  const trigger = page.getByRole('button', { name: 'Buscar no catálogo' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Buscar NFTs' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('teclado: galeria modal contém foco e restaura o acionador', async ({
  page,
}) => {
  await page.goto('/nfts/emerald-ape')
  const trigger = page.getByRole('button', { name: /Ampliar imagem/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('teclado: abas de detalhes com setas e painéis nomeados', async ({
  page,
}) => {
  await page.goto('/nfts/emerald-ape')
  const details = page.getByRole('tab', { name: 'Detalhes do NFT' })
  await details.focus()
  await page.keyboard.press('ArrowRight')
  const reviews = page.getByRole('tab', {
    name: /Avaliações de colecionadores/,
  })
  await expect(reviews).toBeFocused()
  await expect(reviews).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('tabpanel', { name: /Avaliações de colecionadores/ }),
  ).toBeVisible()
  await page.keyboard.press('Home')
  await expect(details).toBeFocused()
  await expect(
    page.getByRole('tabpanel', { name: 'Detalhes do NFT' }),
  ).toBeVisible()
})

test('validação: erros associados ao campo e aba de autenticação nomeada', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/register')
  await page.getByRole('button', { name: 'Criar perfil', exact: true }).click()
  const email = page.getByLabel('E-mail', { exact: true })
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
  await expect(
    page.getByRole('tabpanel', { name: 'Criar conta', exact: true }),
  ).toBeVisible()
  await scan(page, info)
})

test('loading e erro são anunciados; animações respeitam movimento reduzido', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await scenario(page, { latencyMs: 2000 })
  await page.goto('/')
  const status = page.getByRole('status', { name: 'Carregando NFTs' })
  await expect(status).toBeVisible()
  await expect(status).toHaveAttribute('aria-busy', 'true')
  expect(
    await page
      .locator('.shimmer')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await page.goto('/diagnostics')
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await scenario(page, {
    latencyMs: 0,
    failures: [{ path: '/nfts', method: 'GET', status: 503, remaining: 2 }],
  })
  await page.goto('/?q=axe-failure')
  await expect(page.getByRole('alert')).toBeVisible()
  await scan(page, info)
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('catalog-empty')).toBeVisible()
})

test('favorito ativo mantém o nome do toggle e passa axe', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await request(page, '/favorites/emerald-ape', 'PUT')
  await page.goto('/nfts/emerald-ape')
  const favorite = page.getByRole('button', {
    name: 'Favoritar Emerald Ape #042',
    exact: true,
  })
  await expect(favorite).toHaveAttribute('aria-pressed', 'true')
  await scan(page, info)
  await favorite.click()
  await expect(favorite).toHaveAttribute('aria-pressed', 'false')
})

test('galeria mobile: alvos de toque visíveis e sem cobertura pelo painel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/nfts/emerald-ape')
  const dots = page.locator('.gallery-dots button')
  await expect(dots).toHaveCount(5)
  for (const dot of await dots.all()) {
    await expect(dot).toBeVisible()
    const box = (await dot.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
    expect(
      await dot.evaluate((el) => {
        const box = el.getBoundingClientRect()
        return el.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        )
      }),
    ).toBe(true)
    await dot.click()
    await expect(dot).toHaveAttribute('aria-pressed', 'true')
  }
})

for (const path of ['/', '/nfts/emerald-ape', '/checkout']) {
  test(`reflow equivalente a 200% de 1440px: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 })
    if (path === '/checkout') {
      await login(page)
      await addItem(page)
    }
    await page.goto(path)
    await expect(
      page.locator(
        path === '/'
          ? '[data-testid="catalog-grid"]'
          : path.includes('nfts')
            ? '.product-information'
            : '.checkout-presentation',
      ),
    ).toBeVisible()
    await noOverflow(page)
    if (path.includes('nfts'))
      await expect(
        page.getByRole('button', { name: 'Comprar', exact: true }),
      ).toBeVisible()
    if (path === '/checkout')
      await expect(
        page.getByRole('button', { name: 'Confirmar compra', exact: true }),
      ).toBeVisible()
  })
}
