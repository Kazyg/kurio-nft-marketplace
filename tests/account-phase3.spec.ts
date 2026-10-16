import { expect, test, type Page } from '@playwright/test'
import type {
  Session,
  User,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { mockRequest, resetMocks, scenario } from './helpers.js'

async function login(page: Page) {
  const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
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
  await login(page)
})

test('perfil persiste nome, usuário, e-mail e ENS; conflito preserva rascunho', async ({
  page,
}) => {
  await page.goto('/profile')
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Ana Colecionadora')
  await page.getByLabel('Nome de usuário', { exact: true }).fill('ana_nft')
  await page.getByLabel('E-mail', { exact: true }).fill('ana.nft@kurio.demo')
  await page.getByLabel('ENS (opcional)').fill('anacolecionadora.eth')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveValue(
    'ana_nft',
  )
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(
    'ana.nft@kurio.demo',
  )
  await expect(page.getByLabel('ENS (opcional)')).toHaveValue(
    'anacolecionadora.eth',
  )
  const profile = await mockRequest<User>(page, '/profile')
  await mockRequest(page, '/profile', 'PATCH', {
    version: profile.version,
    bio: 'Outra sessão',
  })
  await page
    .getByLabel('Nome de exibição', { exact: true })
    .fill('Meu rascunho preservado')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Profile version changed')
  await page.getByRole('button', { name: 'Carregar versão atual' }).click()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Meu rascunho preservado')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
})

test('avatar validado, enviado e removido; senha valida confirmação e credencial atual', async ({
  page,
}) => {
  await page.goto('/profile')
  await page.getByLabel('Escolher avatar').setInputFiles({
    name: 'avatar.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid'),
  })
  await expect(page.getByRole('alert')).toContainText('PNG, JPEG ou WebP')
  await page.getByLabel('Escolher avatar').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8H0AAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(page.getByAltText('Avatar do perfil')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  await page.reload()
  await expect(page.getByAltText('Avatar do perfil')).toBeVisible()
  await page.getByRole('button', { name: 'Remover avatar' }).click()
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Perfil atualizado')
  expect((await mockRequest<User>(page, '/profile')).avatar).toBeNull()
  await page.getByLabel('Senha atual', { exact: true }).fill('incorreta')
  await page.getByLabel('Nova senha', { exact: true }).fill('NovaKurio123!')
  await page
    .getByLabel('Confirmar nova senha', { exact: true })
    .fill('diferente')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('As senhas não coincidem')
  await page
    .getByLabel('Confirmar nova senha', { exact: true })
    .fill('NovaKurio123!')
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Current password does not match',
  )
  await page.getByLabel('Senha atual', { exact: true }).fill('Kurio123!')
  await page
    .getByRole('button', { name: 'Mostrar senha atual', exact: true })
    .click()
  await expect(page.getByLabel('Senha atual', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click()
  await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()
  await expect(page.getByLabel('Nova senha', { exact: true })).toHaveValue('')
  const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
    email: 'ana@kurio.demo',
    password: 'NovaKurio123!',
  })
  expect(session.user?.id).toBe('ana')
})

test('carteiras adiciona secundária, valida redes, edita, troca principal e trata conflito', async ({
  page,
}) => {
  await page.goto('/wallets')
  await page
    .getByRole('button', { name: 'Adicionar carteira', exact: true })
    .click()
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome da carteira')
    .fill('Coleção Polygon')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Rede', { exact: true })
    .selectOption('polygon')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Endereço público', { exact: true })
    .fill('invalido')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira' })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    '40 caracteres hexadecimais',
  )
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Rede', { exact: true })
    .selectOption('solana')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira' })
    .click()
  await expect(page.getByRole('alert')).toContainText('Solana base58')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Rede', { exact: true })
    .selectOption('polygon')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Provedor', { exact: true })
    .selectOption('walletconnect')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Endereço público', { exact: true })
    .fill(`0x${'a'.repeat(40)}`)
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira' })
    .click()
  await expect(page.getByText('Carteira salva com sucesso.')).toBeVisible()
  const added = (await mockRequest<Wallet[]>(page, '/wallets')).find(
    (wallet) => wallet.label === 'Coleção Polygon',
  )!
  expect(added.isDefault).toBe(false)
  await page
    .getByRole('button', {
      name: 'Tornar principal Coleção Polygon',
      exact: true,
    })
    .click()
  await expect(page.getByText('Carteira principal atualizada.')).toBeVisible()
  const wallets = await mockRequest<Wallet[]>(page, '/wallets')
  expect(
    wallets.filter((wallet) => wallet.isDefault).map((wallet) => wallet.id),
  ).toEqual([added.id])
  await page
    .getByRole('button', { name: 'Editar Coleção Polygon', exact: true })
    .click()
  const current = wallets.find((wallet) => wallet.id === added.id)!
  await mockRequest(page, `/wallets/${added.id}`, 'PATCH', {
    version: current.version,
    label: 'Outra sessão',
  })
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByLabel('Nome da carteira')
    .fill('Minha carteira revisada')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira' })
    .click()
  await expect(page.getByRole('alert')).toContainText('Wallet version changed')
  await page.getByRole('button', { name: 'Carregar versão atual' }).click()
  await expect(
    page
      .locator('.wallet-form[data-active="true"]')
      .getByLabel('Nome da carteira'),
  ).toHaveValue('Minha carteira revisada')
  await page
    .locator('.wallet-form[data-active="true"]')
    .getByRole('button', { name: 'Salvar carteira' })
    .click()
  await expect(
    page.getByRole('button', {
      name: 'Editar Minha carteira revisada',
      exact: true,
    }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', {
      name: 'Editar Minha carteira revisada',
      exact: true,
    }),
  ).toBeVisible()
})

test('perfil e carteiras mostram carregamento, falha recuperável e permitem tentar novamente', async ({
  page,
}) => {
  for (const path of ['/profile', '/wallets']) {
    await scenario(page, {
      latencyMs: 600,
      failures: [{ path, method: 'GET', status: 503, remaining: 3 }],
    })
    await page.goto(path)
    await expect(
      page.getByRole('status', { name: '' }).filter({ hasText: 'Carregando' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible({ timeout: 20_000 })
    await scenario(page, { latencyMs: 0, failures: [] })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(
      page.getByRole('button', {
        name: path === '/profile' ? 'Salvar perfil' : 'Adicionar carteira',
        exact: true,
      }),
    ).toBeVisible()
  }
})

for (const width of [390, 768, 1440]) {
  test(`conta responsiva sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/profile', '/wallets']) {
      await page.goto(path)
      await expect(
        page.getByRole('button', {
          name: path === '/profile' ? 'Salvar perfil' : 'Adicionar carteira',
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByText('Carregando carteiras…')).toBeHidden()
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(
          Array.from(document.images).map((image) => {
            image.loading = 'eager'
            return image.decode()
          }),
        )
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      expect(
        await page.evaluate(() =>
          Array.from(document.images).every(
            (image) => image.complete && image.naturalWidth > 0,
          ),
        ),
      ).toBe(true)
      await page.screenshot({
        path: `test-results/account-${path.slice(1)}-${width}.png`,
        fullPage: true,
      })
    }
  })
}
