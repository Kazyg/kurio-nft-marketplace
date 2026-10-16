import { expect, test, type Page } from '@playwright/test'
import type {
  Session,
  User,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks, scenario } from './helpers.js'
import { p4Request } from './phase4-helpers.js'

async function signIn(page: Page) {
  const session = await p4Request<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'Kurio123!',
  })
  await page.evaluate(
    (token) => localStorage.setItem('kurio.accessToken', token!),
    session.accessToken,
  )
}
test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
  await signIn(page)
})

for (const width of [390, 768, 1440])
  for (const route of ['profile', 'wallets']) {
    test(`conta Figma ${route}: composição e captura em ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/${route}`)
      await expect(
        page.getByRole('button', {
          name: route === 'profile' ? 'Salvar perfil' : 'Salvar carteira',
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: 'Conta do colecionador' })
          .getByRole('link', {
            name: route === 'profile' ? 'Dados do perfil' : 'Carteiras',
            exact: true,
          }),
      ).toHaveAttribute('aria-current', 'page')
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          Array.from(document.images)
            .filter((image) => !image.loading || image.loading !== 'lazy')
            .map((image) => image.decode()),
        )
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      if (width === 1440) {
        const shell = await page.locator('.account-shell').boundingBox(),
          sidebar = await page.locator('.account-sidebar').boundingBox(),
          main = await page.locator('.account-main').boundingBox()
        expect(shell?.width).toBeCloseTo(1200, 0)
        expect(shell?.x).toBeCloseTo(120, 0)
        expect(sidebar?.width).toBeCloseTo(310, 0)
        expect(main?.width).toBeCloseTo(862, 0)
        const input = await page
          .getByLabel('Nome de exibição', { exact: true })
          .boundingBox()
        expect(input?.width).toBeCloseTo(417, 0)
        expect(input?.height).toBeCloseTo(40, 0)
      }
      await page.screenshot({
        path: testInfo.outputPath(`account-figma-${route}-${width}.png`),
        fullPage: true,
      })
    })
  }

test('perfil edita apelido da carteira por REST e mantém dados após refresh', async ({
  page,
}) => {
  await page.goto('/profile')
  await expect(page.getByLabel('Apelido da carteira')).toBeEnabled()
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Ana perfil revisado')
  await page.getByLabel('Apelido da carteira').fill('Carteira do perfil')
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/wallets/') &&
      response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  expect((await saved).fromServiceWorker()).toBe(true)
  await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana perfil revisado')
  await expect(page.getByLabel('Apelido da carteira')).toHaveValue(
    'Carteira do perfil',
  )
  expect((await p4Request<User>(page, '/profile')).name).toBe(
    'Ana perfil revisado',
  )
})

test('carteiras persistem metadados e secundária sem duplicar ao reutilizar principal', async ({
  page,
}) => {
  await page.goto('/wallets')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Ana carteira')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome do perfil', { exact: true })
    .fill('ana_wallet')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('ENS ou carteira secundária (opcional)')
    .fill('ana.eth')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Código de indicação')
    .fill('KURIOANA')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('E-mail', { exact: true })
    .fill('wallet@kurio.demo')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome ENS', { exact: true })
    .fill('anawallet.eth')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira', exact: true })
    .click()
  await expect(page.getByText('Carteira salva com sucesso.')).toBeVisible()
  const before = await p4Request<Wallet[]>(page, '/wallets')
  const main = before.find((wallet) => wallet.isDefault)!
  expect(main).toMatchObject({
    displayName: 'Ana carteira',
    profileName: 'ana_wallet',
    secondaryAddress: 'ana.eth',
    referralCode: 'KURIOANA',
    email: 'wallet@kurio.demo',
    ens: 'anawallet.eth',
  })
  await page.getByLabel('Igual à carteira principal').check()
  await expect(
    page.getByText(
      'A carteira principal será utilizada. Nenhum cadastro adicional foi criado.',
    ),
  ).toBeVisible()
  expect(
    (await p4Request<Wallet[]>(page, '/wallets')).map((wallet) => wallet.id),
  ).toEqual(before.map((wallet) => wallet.id))
  await page
    .getByRole('button', { name: 'Adicionar carteira', exact: true })
    .click()
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome da carteira')
    .fill('Secundária Ethereum')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Endereço público', { exact: true })
    .fill(`0x${'b'.repeat(40)}`)
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Rede', { exact: true })
    .selectOption('ethereum')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira', exact: true })
    .click()
  await expect(page.getByText('Carteira salva com sucesso.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Editar Secundária Ethereum',
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page
      .locator('.wallet-form[data-active="true"]')
      .getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana carteira')
  const after = await p4Request<Wallet[]>(page, '/wallets')
  expect(after).toHaveLength(before.length + 1)
  expect(new Set(after.map((wallet) => wallet.id)).size).toBe(after.length)
  expect(after.find((wallet) => wallet.isDefault)?.id).toBe(main.id)
})

test('sidebar navega para carteiras, favoritos e pedidos com indisponibilidade honesta', async ({
  page,
}) => {
  await page.goto('/profile')
  const nav = page.getByRole('navigation', { name: 'Conta do colecionador' })
  await nav.getByRole('button', { name: 'Ofertas', exact: true }).click()
  await expect(
    page.getByText('Ofertas ainda não está disponível.'),
  ).toBeVisible()
  await nav.getByRole('link', { name: 'Carteiras', exact: true }).click()
  await expect(page).toHaveURL(/\/wallets$/)
  await nav.getByRole('link', { name: 'Atividade', exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await page.goto('/profile')
  await nav
    .getByRole('link', { name: 'Lista de interesse', exact: true })
    .click()
  await expect(page).toHaveURL(/\/favorites$/)
})
