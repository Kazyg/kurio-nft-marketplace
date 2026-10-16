import { expect, test, type Page } from '@playwright/test'
import type { Session } from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

async function signIn(page: Page) {
  const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
}

async function expectViewportWidth(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    })),
  ).toEqual({ viewport: width, document: width, body: width })
  expect(
    await page.evaluate(() =>
      [document.documentElement, document.body].some(
        (element) =>
          !element.hasAttribute('data-scroll-locked') &&
          ['hidden', 'clip'].includes(getComputedStyle(element).overflowX),
      ),
    ),
  ).toBe(false)
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __kurioOverflowWidths?: number[] })
          .__kurioOverflowWidths,
    ),
  ).toEqual([])
}

test('primeira navegação lazy da conta preserva sidebar e documento', async ({
  page,
}) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
  await signIn(page)
  await page.goto('/profile')
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeVisible()
  const sidebar = page.locator('.account-sidebar')
  await sidebar.evaluate((element) => {
    element.setAttribute('data-stability', 'initial')
  })
  const documents: string[] = []
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url())
    }
  })
  let release!: () => void
  let requested!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  const moduleRequested = new Promise<void>((resolve) => (requested = resolve))
  await page
    .context()
    .route(
      /\/(?:assets\/wallets-route\.lazy-[^/]+\.js|src\/app\/wallets-route\.lazy\.ts)(?:\?.*)?$/,
      async (route) => {
        requested()
        await held
        await route.continue()
      },
    )
  const navigation = page
    .getByRole('navigation', { name: 'Conta do colecionador' })
    .getByRole('link', { name: 'Carteiras', exact: true })
    .click()
  try {
    await moduleRequested
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveAttribute('data-stability', 'initial')
    await expect(page.locator('.site-header')).toBeVisible()
  } finally {
    release()
  }
  await navigation
  await expect(page.locator('.account-main h1')).toHaveText(
    'Carteira principal',
  )
  for (const [label, heading] of [
    ['Atividade', 'Meus pedidos'],
    ['Lista de interesse', 'Seus favoritos'],
    ['Dados do perfil', 'Perfil do colecionador'],
  ]) {
    await page
      .getByRole('navigation', { name: 'Conta do colecionador' })
      .getByRole('link', { name: label, exact: true })
      .click()
    await expect(page.locator('.account-main h1')).toHaveText(heading)
    await expect(sidebar).toBeVisible()
    await expect(sidebar).toHaveAttribute('data-stability', 'initial')
  }
  expect(documents).toEqual([])
  expect(
    await page.evaluate(() => performance.getEntriesByType('navigation')),
  ).toHaveLength(1)
})

for (const width of [375, 390, 414, 768]) {
  test(`refresh e autenticação direta preservam viewport de ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      const widths: number[] = []
      Object.defineProperty(window, '__kurioOverflowWidths', { value: widths })
      function inspectWidth() {
        const documentWidth = document.documentElement?.scrollWidth ?? 0
        if (documentWidth > innerWidth + 1) widths.push(documentWidth)
        requestAnimationFrame(inspectWidth)
      }
      requestAnimationFrame(inspectWidth)
    })
    await resetMocks(page)
    await scenario(page, { latencyMs: 0 })
    await page.goto('/')
    await expect(page.locator('.hero h1')).toBeVisible()
    await expectViewportWidth(page, width)
    await page.reload()
    await expect(page.locator('.hero h1')).toBeVisible()
    await expectViewportWidth(page, width)
    await page.getByRole('button', { name: 'Meu perfil', exact: true }).click()
    await expect(page.locator('.auth-form')).toBeVisible()
    await expectViewportWidth(page, width)
    if (width < 768) {
      await page.getByRole('link', { name: '← Voltar' }).click()
    } else {
      await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    }
    await expect(page.locator('.hero h1')).toBeVisible()
    await expectViewportWidth(page, width)
    for (const path of ['/login', '/register']) {
      await page.goto(path)
      await expect(page.locator('.auth-form')).toBeVisible()
      await expectViewportWidth(page, width)
      await page.reload()
      await expect(page.locator('.auth-form')).toBeVisible()
      await page.locator('.auth-form input[type="email"]').focus()
      await expectViewportWidth(page, width)
      if (width < 768) {
        await expect(page.locator('.auth-form input[type="email"]')).toHaveCSS(
          'font-size',
          '16px',
        )
      }
    }
    await signIn(page)
    await page.goto('/profile')
    await expect(
      page.getByLabel('Nome de exibição', { exact: true }),
    ).toBeVisible()
    for (const label of [
      'Carteiras',
      'Atividade',
      'Lista de interesse',
      'Dados do perfil',
    ]) {
      const link = page
        .getByRole('navigation', { name: 'Conta do colecionador' })
        .getByRole('link', { name: label, exact: true })
      await link.click()
      await expect(link).toHaveAttribute('aria-current', 'page')
      await expectViewportWidth(page, width)
    }
  })
}
