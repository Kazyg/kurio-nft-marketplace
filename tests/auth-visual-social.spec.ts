import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  Favorites,
  Session,
  User,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
})

async function social(page: Page, provider: 'Google' | 'Facebook') {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/social') &&
      response.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: `Continuar com ${provider}`, exact: true })
    .click()
  const result = await response
  expect(result.fromServiceWorker()).toBe(true)
  expect(result.status()).toBe(200)
  expect(result.request().postDataJSON()).toEqual({
    provider: provider.toLowerCase(),
  })
  return (await result.json()) as Session
}

for (const width of [390, 414, 1440])
  for (const mode of ['login', 'register'])
    test(`Figma ${mode} em ${width}px: medidas, ícones e ausência de overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/${mode}`)
      const creating = mode === 'register'
      const email = page.getByLabel('E-mail', { exact: true })
      await expect(email).toBeVisible()
      const scope =
        width === 1440 ? page.getByRole('dialog') : page.locator('.auth-page')
      if (width === 1440) {
        const frame = (await scope.boundingBox())!
        expect(frame.width).toBe(500)
        expect(frame.height).toBe(creating ? 656 : 600)
        expect(frame.x).toBe(470)
        expect(frame.y).toBe(creating ? 158 : 160)
        expect((await email.boundingBox())!.width).toBe(340)
        expect((await email.boundingBox())!.height).toBe(40)
        await expect(page.locator('.auth-background')).toHaveAttribute(
          'inert',
          '',
        )
        await expect(
          scope.getByRole('tab', {
            name: creating ? 'Criar conta' : 'Entrar',
            exact: true,
          }),
        ).toHaveAttribute('aria-selected', 'true')
      } else {
        await expect(page.getByRole('dialog')).toHaveCount(0)
        expect((await page.locator('.auth-brand').boundingBox())!.y).toBe(80)
        expect((await scope.getByRole('heading').boundingBox())!.y).toBe(256)
        expect((await page.locator('.auth-form').boundingBox())!.y).toBe(312)
        expect((await email.boundingBox())!.width).toBe(width - 56)
        expect((await email.boundingBox())!.height).toBe(50)
        const cta = (await page.locator('.auth-submit').boundingBox())!
        expect(cta.y).toBe(creating ? 588 : 492)
        expect(cta.height).toBe(60)
        expect((await page.locator('.auth-social').boundingBox())!.y).toBe(
          creating ? 688 : 592,
        )
        expect((await page.locator('.auth-switch').boundingBox())!.y).toBe(
          creating ? 852 : 756,
        )
      }
      await expect(scope.locator('.auth-demo-notice')).toHaveCount(0)
      await expect(
        scope.getByRole('button', {
          name: 'Continuar com Google',
          exact: true,
        }),
      ).toBeEnabled()
      await expect(
        scope.getByRole('button', {
          name: 'Continuar com Facebook',
          exact: true,
        }),
      ).toBeEnabled()
      const google = (await scope.locator('.auth-google-icon').boundingBox())!
      expect(google.width).toBe(20)
      expect(google.height).toBe(20)
      const facebook = (await scope
        .locator('img[src$="auth-facebook.svg"]')
        .boundingBox())!
      expect(facebook.width).toBe(20)
      expect(facebook.height).toBe(20)
      expect(
        (await scope
          .locator('.auth-social-buttons button')
          .first()
          .boundingBox())!.height,
      ).toBe(40)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          [
            ...document.querySelectorAll<HTMLImageElement>(
              '.auth-form-wrap img',
            ),
          ].map((image) => image.decode()),
        )
        scrollTo(0, 0)
      })
      if (creating && width !== 1440) {
        await expect(page.locator('.auth-confirm-toggle img')).toBeVisible()
        expect(
          (await page.locator('.auth-confirm-toggle img').boundingBox())!.width,
        ).toBeGreaterThan(15)
      }
      await page.screenshot({
        path: test.info().outputPath(`auth-figma-${mode}-${width}.png`),
        fullPage: width !== 1440,
      })
    })

for (const width of [390, 1440])
  for (const mode of ['login', 'register'])
    for (const provider of ['Google', 'Facebook'] as const)
      test(`${provider} em ${mode} ${width}px autentica por Axios/MSW e persiste`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`/${mode}?redirect=%2Fprofile`)
        const session = await social(page, provider)
        expect(session.user?.id).toBe(`demo-social-${provider.toLowerCase()}`)
        expect(session.accessToken).toBeTruthy()
        await expect(page).toHaveURL(/\/profile$/)
        await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(
          session.user!.email,
        )
        await page.reload()
        await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(
          session.user!.email,
        )
        expect(
          (await mockRequest<Session>(page, '/auth/session')).user?.id,
        ).toBe(session.user!.id)
        expect((await mockRequest<User>(page, '/profile')).id).toBe(
          session.user!.id,
        )
        expect(await mockRequest<Wallet[]>(page, '/wallets')).toEqual([])
      })

test('abas desktop funcionam com teclado, Escape/X restauram foco e scroll', async ({
  page,
}) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Entrar', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: 'Entrar', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(
    dialog.getByRole('tab', { name: 'Criar conta', exact: true }),
  ).toBeFocused()
  await expect(dialog.getByLabel('Nome de usuário')).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(
    dialog.getByRole('tab', { name: 'Entrar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('body')).not.toHaveAttribute(
    'data-scroll-locked',
    '1',
  )
  await trigger.click()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(trigger).toBeFocused()
})

test('páginas mobile alternam sem perder destino e permitem cadastro com tela curta', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto('/login?redirect=%2Fprofile')
  await page
    .getByRole('button', { name: 'Crie uma conta', exact: true })
    .click()
  await expect(page).toHaveURL(/\/register\?redirect=%2Fprofile/)
  await expect(
    page.getByRole('heading', {
      name: 'Criar perfil de colecionador',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByLabel('Nome de usuário').fill('Novo colecionador')
  await page
    .getByLabel('E-mail', { exact: true })
    .fill('novo-social-layout@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByLabel('Confirmar senha', { exact: true }).fill('errada')
  await page.getByRole('button', { name: 'Criar perfil', exact: true }).click()
  await expect(
    page.getByText('As senhas não coincidem.', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Confirmar senha', { exact: true }).fill('Kurio123!')
  await page
    .getByRole('button', { name: 'Mostrar confirmação de senha', exact: true })
    .click()
  await expect(
    page.getByLabel('Confirmar senha', { exact: true }),
  ).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Criar perfil', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
})

test('provedores recuperam identidades estáveis, isolam perfil/favoritos e logout', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  const google = await social(page, 'Google')
  await expect(page).toHaveURL(/\/profile$/)
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Google privado')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect
    .poll(async () => (await mockRequest<User>(page, '/profile')).name)
    .toBe('Google privado')
  await mockRequest(page, '/favorites/emerald-ape', 'PUT')
  await page
    .locator('.site-header')
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const facebook = await social(page, 'Facebook')
  await expect(page).toHaveURL(/\/profile$/)
  expect(facebook.user?.id).not.toBe(google.user?.id)
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).not.toHaveValue('Google privado')
  expect((await mockRequest<Favorites>(page, '/favorites')).nftIds).toEqual([])
  await page
    .locator('.site-header')
    .getByRole('button', { name: 'Sair', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const again = await social(page, 'Google')
  expect(again.user?.id).toBe(google.user?.id)
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Google privado')
  expect((await mockRequest<Favorites>(page, '/favorites')).nftIds).toContain(
    'emerald-ape',
  )
})

test('falha social mantém visitante, bloqueia duplicatas e permite tentar novamente', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  const google = page.getByRole('button', {
    name: 'Continuar com Google',
    exact: true,
  })
  await expect(google).toBeVisible()
  await scenario(page, {
    latencyMs: 800,
    failures: [
      { path: '/auth/social', method: 'POST', status: 503, remaining: 1 },
    ],
  })
  let count = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/social')) count++
  })
  await google.click()
  await expect(google).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Continuar com Facebook', exact: true }),
  ).toBeDisabled()
  await expect(page.locator('.auth-submit')).toBeDisabled()
  await expect(page.getByRole('alert')).toHaveText(
    'Não foi possível entrar. Tente novamente.',
  )
  expect(count).toBe(1)
  expect((await mockRequest<Session>(page, '/auth/session')).user).toBeNull()
  await social(page, 'Google')
  await expect(page).toHaveURL(/\/profile$/)
  expect(count).toBe(2)
})

for (const provider of ['Google', 'Facebook'] as const)
  test(`${provider} mescla carrinho e retoma checkout sem criar pedido`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: provider === 'Google' ? 390 : 1440,
      height: 900,
    })
    await page.goto('/nfts/emerald-ape')
    await page.getByRole('button', { name: 'Comprar', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'NFT adicionado' }),
    ).toBeVisible()
    await page.goto('/cart')
    await expect(page.getByTestId('quote-status')).toHaveText(
      'Cotação atualizada',
    )
    await page
      .getByRole('link', { name: 'Conectar e finalizar', exact: true })
      .click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await social(page, provider)
    await expect(page).toHaveURL(/\/checkout$/)
    if ((page.viewportSize()?.width || 1440) < 768) {
      await expect(page.getByTestId('checkout-mobile-total')).toBeVisible()
      await page.locator('#checkout-wallet-details > summary').click()
    }
    await expect(page.getByTestId('purchase-total')).toBeVisible()
    const cart = await mockRequest<Cart>(page, '/cart')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ nftId: 'emerald-ape', quantity: 1 })
    expect(await mockRequest(page, '/orders')).toEqual([])
    await page.reload()
    if ((page.viewportSize()?.width || 1440) < 768) {
      await expect(page.getByTestId('checkout-mobile-total')).toBeVisible()
      await page.locator('#checkout-wallet-details > summary').click()
    }
    await expect(page.getByTestId('purchase-total')).toBeVisible()
    expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(1)
  })

for (const width of [390, 1440])
  test(`social retoma favorito em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(width < 768 ? '/?q=Emerald' : '/nfts/emerald-ape')
    await page
      .getByRole('button', { name: 'Favoritar Emerald Ape #042', exact: true })
      .click()
    await social(page, 'Google')
    if (width < 768)
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === '/' && url.searchParams.get('q') === 'Emerald',
      )
    else await expect(page).toHaveURL(/\/nfts\/emerald-ape$/)
    await expect(
      page.getByRole('button', {
        name: 'Favoritar Emerald Ape #042',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      (await mockRequest<{ nftIds: string[] }>(page, '/favorites')).nftIds,
    ).toContain('emerald-ape')
  })

test('expiração social pede nova sessão da mesma identidade e rejeita provedor inválido', async ({
  page,
}) => {
  const invalid = await page.evaluate(
    async () =>
      (
        await fetch('/api/auth/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'github' }),
        })
      ).status,
  )
  expect(invalid).toBe(422)
  await scenario(page, { sessionTtlMs: 1500 })
  await page.clock.install()
  await page.goto('/login?redirect=%2Fprofile')
  const first = await social(page, 'Facebook')
  await expect(page).toHaveURL(/\/profile$/)
  await page.clock.fastForward(3000)
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  await scenario(page, { sessionTtlMs: 3600000 })
  const next = await social(page, 'Facebook')
  expect(next.user?.id).toBe(first.user?.id)
  await expect(page).toHaveURL(/\/profile$/)
})
