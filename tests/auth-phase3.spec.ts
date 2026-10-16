import { expect, test } from '@playwright/test'
import { resetMocks } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await resetMocks(page)
})

test('login valida campos, mostra senha e retoma rota privada', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofile')
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog.getByText('Informe um e-mail válido.')).toBeVisible()
  await dialog.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await dialog.getByLabel('Senha', { exact: true }).fill('incorreta')
  await dialog.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(dialog.getByLabel('Senha', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await dialog.getByRole('button', { name: 'Ocultar senha' }).click()
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'E-mail ou senha incorretos.',
  )
  await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await dialog.getByLabel('Senha', { exact: true }).press('Enter')
  await expect(page).toHaveURL(/\/profile$/)
  await page.reload()
  await expect(page).toHaveURL(/\/profile$/)
})

test('cadastro valida confirmação, conflito e cria sessão', async ({
  page,
}) => {
  await page.goto('/register?redirect=%2Fprofile')
  const dialog = page.getByRole('dialog', { name: 'Crie sua conta' })
  await dialog.getByLabel('Nome de usuário').fill('Nova colecionadora')
  await dialog.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await dialog.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill('diferente')
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(dialog.getByText('As senhas não coincidem.')).toBeVisible()
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill('Kurio123!')
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(
    dialog.getByText('Este e-mail já está cadastrado.'),
  ).toBeVisible()
  await dialog.getByLabel('E-mail', { exact: true }).fill('nova@kurio.demo')
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
})

test('dialog mantém foco e Escape fecha sem aceitar redirect externo', async ({
  page,
}) => {
  await page.goto('/login?redirect=https%3A%2F%2Fevil.example')
  const dialog = page.getByRole('dialog', { name: 'Entrar na Kurio' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    dialog.getByRole('tab', { name: 'Entrar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByLabel('E-mail', { exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    dialog.getByRole('tab', { name: 'Entrar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    dialog.getByRole('button', { name: 'Fechar', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(
    (url) => url.pathname === '/' && url.hostname === '127.0.0.1',
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('mobile usa página de autenticação e preserva destino privado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Entrar', exact: true }),
  ).toBeVisible()
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
})
