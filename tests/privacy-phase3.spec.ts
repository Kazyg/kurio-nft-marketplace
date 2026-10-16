import { expect, test, type Page } from '@playwright/test'
import { mockRequest, resetMocks, scenario } from './helpers.js'
import type { Favorites } from '../src/shared/contracts/marketplace.js'

async function signIn(page: Page, email: string) {
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await dialog.getByLabel('E-mail', { exact: true }).fill(email)
  await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
})

test('logout e troca de usuário não reutilizam perfil ou carteiras privados', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  await signIn(page, 'ana@kurio.demo')
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana')
  await page.getByLabel('Nome de exibição', { exact: true }).fill('Ana privada')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  await mockRequest(page, '/wallets', 'POST', {
    label: 'Carteira privada da Ana',
    address: `0x${'a'.repeat(40)}`,
    network: 'ethereum',
    provider: 'metamask',
    isDefault: false,
  })
  await page.goto('/wallets')
  await expect(
    page.getByText('Carteira privada da Ana', { exact: true }),
  ).toBeVisible()
  await page
    .locator('.site-header')
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fwallets/)
  await expect(
    page.getByText('Carteira privada da Ana', { exact: true }),
  ).toBeHidden()
  await signIn(page, 'bruno@kurio.demo')
  await expect(page).toHaveURL(/\/wallets$/)
  await expect(
    page.getByText('Carteira privada da Ana', { exact: true }),
  ).toBeHidden()
  await page
    .getByRole('navigation', { name: 'Conta do colecionador' })
    .getByRole('link', { name: 'Dados do perfil', exact: true })
    .click()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Bruno')
  await page.reload()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Bruno')
})

test('sessão expirada na rota privada pede login e retoma a rota original', async ({
  page,
}) => {
  await scenario(page, { sessionTtlMs: 2200 })
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  await signIn(page, 'ana@kurio.demo')
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/, {
    timeout: 8000,
  })
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeHidden()
  await signIn(page, 'ana@kurio.demo')
  await expect(page).toHaveURL(/\/profile$/)
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana')
})

test('logout descarta dados privados mesmo se a consulta seguinte de sessão falhar', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  await signIn(page, 'ana@kurio.demo')
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana')
  await scenario(page, {
    failures: [
      { path: '/auth/session', method: 'GET', status: 503, remaining: 2 },
    ],
  })
  await page
    .locator('.site-header')
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeHidden()
  await expect(
    page.getByRole('dialog', { name: 'Entrar na Kurio' }),
  ).toBeVisible()
})

test('favorito mobile usa página de login e retoma a ação no catálogo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?q=Emerald')
  await page
    .getByRole('button', { name: 'Favoritar Emerald Ape #042', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === '/' && url.searchParams.get('q') === 'Emerald',
  )
  await expect(
    page.getByRole('button', {
      name: 'Favoritar Emerald Ape #042',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect((await mockRequest<Favorites>(page, '/favorites')).nftIds).toContain(
    'emerald-ape',
  )
})

test('login em andamento impede submissões repetidas', async ({ page }) => {
  await scenario(page, { latencyMs: 500 })
  await page.goto('/login?redirect=%2Fprofile')
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await dialog.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  const password = dialog.getByLabel('Senha', { exact: true })
  await password.fill('Kurio123!')
  let requests = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/auth/login'
    )
      requests++
  })
  await password.press('Enter')
  await password.press('Enter')
  await expect(
    dialog.getByRole('button', { name: 'Entrando…', exact: true }),
  ).toBeDisabled()
  await expect(page).toHaveURL(/\/profile$/)
  expect(requests).toBe(1)
})

for (const width of [390, 768, 1440]) {
  test(`autenticação sem overflow e com campos acessíveis em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const path of ['/login', '/register']) {
      await page.goto(path)
      await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
      if (path === '/register')
        await expect(
          page.getByLabel('Confirmar senha', { exact: true }),
        ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      const dialog = page.getByRole('dialog')
      if (width >= 768)
        await dialog.screenshot({
          path: test.info().outputPath(`auth-${path.slice(1)}-${width}.png`),
        })
      else
        await page.screenshot({
          path: test.info().outputPath(`auth-${path.slice(1)}-${width}.png`),
          fullPage: true,
        })
    }
  })
}
