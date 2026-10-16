import { test, expect } from '@playwright/test'
import type { Cart, Order } from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request } from './phase4-helpers.js'

test('catálogo → detalhe → carrinho → login → checkout → recibo sem criar compra no retorno', async ({
  page,
}) => {
  await resetMocks(page)
  await p4Request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
  await page.goto('/?q=Emerald')
  await page
    .getByTestId('catalog-card')
    .filter({ hasText: 'Emerald' })
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(/\/nfts\/emerald-ape$/)
  const added = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/cart/items' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Comprar', exact: true }).click()
  expect((await added).status()).toBe(200)
  await page
    .getByRole('button', { name: 'Carrinho, 1 itens', exact: true })
    .click()
  await expect(page.getByTestId('quote-status')).toHaveText(
    'Cotação atualizada',
  )
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(
    page.getByRole('heading', { name: 'Revise antes de enviar' }),
  ).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  const receipt = page.getByRole('dialog', { name: 'Compra confirmada' })
  await expect(receipt).toBeVisible()
  await expect(receipt).toContainText('Emerald Ape')
  await page.keyboard.press('Escape')
  await expect(receipt).toBeHidden()
  const before = await p4Request<Order[]>(page, '/orders')
  expect(before).toHaveLength(1)
  expect((await p4Request<Cart>(page, '/cart')).items).toHaveLength(0)
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const after = await p4Request<Order[]>(page, '/orders')
  expect(after.map((order) => order.id)).toEqual(
    before.map((order) => order.id),
  )
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toContainText(before[0]!.id)
})
