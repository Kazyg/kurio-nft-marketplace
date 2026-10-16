import { expect, test, type Page } from '@playwright/test'
import type {
  Cart,
  NftList,
  Order,
  Session,
  Wallet,
} from '../src/shared/contracts/marketplace.js'
import { resetMocks } from './helpers.js'
import { p4Request as mockRequest } from './phase4-helpers.js'
import type { MockScenario } from '../src/shared/contracts/marketplace.js'
const scenario = (page: Page, value: Partial<MockScenario>) =>
  mockRequest(page, '/__mock/scenario', 'PATCH', value)

async function prepare(page: Page, authenticated = true) {
  if (authenticated) {
    const session = await mockRequest<Session>(page, '/auth/login', 'POST', {
      email: 'ana@kurio.demo',
      password: 'Kurio123!',
    })
    await page.evaluate(
      (token) => localStorage.setItem('kurio.accessToken', token!),
      session.accessToken,
    )
  }
  const catalog = await mockRequest<NftList>(page, '/nfts?pageSize=24')
  const nft = catalog.items.find(
    (item) =>
      item.network === 'ethereum' &&
      item.editions.some((edition) => edition.available >= 3),
  )!
  const edition = nft.editions.find((item) => item.available >= 3)!
  await mockRequest<Cart>(page, '/cart/items', 'POST', {
    nftId: nft.id,
    editionId: edition.id,
    quantity: 1,
  })
  await page.goto('/checkout')
  if (authenticated && (page.viewportSize()?.width || 1440) < 768)
    await page.locator('#checkout-wallet-details > summary').click()
  if (authenticated)
    await expect(
      page.getByLabel('Nome de exibição', { exact: true }),
    ).toBeVisible()
  else await expect(page).toHaveURL(/\/login/)
  return { nft, edition }
}
async function connect(page: Page) {
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
  await page
    .getByRole('button', { name: 'Conectar carteira', exact: true })
    .click()
}
async function review(page: Page) {
  await connect(page)
}
async function buy(page: Page) {
  await review(page)
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
}
test.beforeEach(async ({ page }) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
})

test('checkout completo confirma e mostra recibo persistido, pedidos e foco do modal', async ({
  page,
}) => {
  const { nft } = await prepare(page)
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toHaveValue('Ana')
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(
    'ana@kurio.demo',
  )
  await expect(
    page.getByRole('heading', { name: 'Revise antes de enviar' }),
  ).toHaveCount(0)
  await buy(page)
  const dialog = page.getByRole('dialog', { name: 'Compra confirmada' })
  await expect(dialog).toBeVisible()
  for (const image of await dialog.locator('img').all()) {
    await expect
      .poll(() =>
        image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0)
  }
  const artwork = dialog.locator('.receipt-thank-you img')
  await expect(artwork).toBeVisible()
  expect((await artwork.boundingBox())!.height).toBeCloseTo(80, 0)
  await expect(dialog).toContainText(nft.name)
  await expect(dialog).toContainText('ID da transação')
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(1)
  await expect(dialog).toContainText(orders[0].transactionReference)
  await expect(dialog.getByTestId('purchase-total')).toHaveText(
    `${orders[0].snapshot.totalEth} ETH`,
  )
  await expect
    .poll(() =>
      page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('link', { name: 'Ver detalhes do pedido' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pedido confirmado' }),
  ).toBeVisible()
  await expect(page.getByTestId('purchase-total')).toHaveText(
    `${orders[0].snapshot.totalEth} ETH`,
  )
})

test('checkout visitante retoma a rota após login', async ({ page }) => {
  await prepare(page, false)
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('E-mail', { exact: true }).fill('ana@kurio.demo')
  await page.getByLabel('Senha', { exact: true }).fill('Kurio123!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(
    page.getByRole('heading', { name: 'Finalizar compra', exact: true }),
  ).toBeVisible()
})

test('conexão recusada, conexão permitida, desconexão e troca de carteira/rede', async ({
  page,
}) => {
  await prepare(page)
  await mockRequest<Wallet>(page, '/wallets', 'POST', {
    label: 'Carteira Polygon',
    address: '0x2222222222222222222222222222222222222222',
    network: 'polygon',
    provider: 'metamask',
    isDefault: false,
  })
  await page.reload()
  await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
  await page
    .getByRole('button', { name: 'Recusar conexão', exact: true })
    .click()
  await expect(
    page.getByText('Conexão recusada', { exact: true }),
  ).toBeVisible()
  await connect(page)
  await page.getByRole('button', { name: 'Desconectar carteira' }).click()
  await expect(
    page.getByText('Carteira desconectada', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByLabel('Carteira cadastrada').locator('option'),
  ).toHaveText(['Carteira Ethereum · ethereum'])
  await expect(
    page.getByLabel('Rede', { exact: true }).locator('option'),
  ).toHaveCount(1)
  await expect(page.getByLabel('Rede', { exact: true })).toHaveValue('ethereum')
  await connect(page)
  await expect(
    page.getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    }),
  ).toBeEnabled()
})

test('campos validados e revisão obrigatória impedem envio antecipado', async ({
  page,
}) => {
  await prepare(page)
  await connect(page)
  await page.getByLabel('Nome de exibição', { exact: true }).fill('')
  await page.getByLabel('E-mail', { exact: true }).fill('invalid')
  await page
    .getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    })
    .click()
  await expect(page.getByText('Informe seu nome completo.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(0)
})

test('cliques repetidos criam somente um pedido', async ({ page }) => {
  await prepare(page)
  await review(page)
  await scenario(page, { latencyMs: 250 })
  const button = page.getByRole('button', {
    name: 'Confirmar compra',
    exact: true,
  })
  await button.evaluate((element) => {
    ;(element as HTMLButtonElement).click()
    ;(element as HTMLButtonElement).click()
    ;(element as HTMLButtonElement).click()
  })
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
})

test('recusa preserva carrinho e não exibe recibo de sucesso', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'declined' })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Pedido recusado' }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(1)
})

test('pedido pendente sobrevive ao refresh e chega à confirmação', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, {
    orderOutcome: 'pending-confirmed',
    orderResolutionMs: 2500,
  })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Pedido pendente' }),
  ).toBeVisible()
  const original = (await mockRequest<Order[]>(page, '/orders'))[0]
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(1)
  expect(orders[0].id).toBe(original.id)
})

test('timeout após criação recupera o pedido original sem duplicação', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'timeout-after-create' })
  await buy(page)
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible({ timeout: 20000 })
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
})

test('refresh durante envio recupera a compra persistida antes do timeout da resposta', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'timeout-after-create' })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Enviando pedido…' }),
  ).toBeVisible()
  await expect
    .poll(async () => (await mockRequest<Order[]>(page, '/orders')).length)
    .toBe(1)
  const original = (await mockRequest<Order[]>(page, '/orders'))[0]
  const before = await page.evaluate(() =>
    localStorage.getItem('kurio:purchase:ana'),
  )
  expect(JSON.parse(before!).orderId).toBeUndefined()
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const recovered = await page.evaluate(() =>
    localStorage.getItem('kurio:purchase:ana'),
  )
  expect(JSON.parse(recovered!).key).toBe(JSON.parse(before!).key)
  expect(JSON.parse(recovered!).payload).toEqual(JSON.parse(before!).payload)
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(1)
  expect(orders[0].id).toBe(original.id)
})

test('pedido pendente termina recusado e preserva itens sem recibo de sucesso', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, {
    orderOutcome: 'pending-declined',
    orderResolutionMs: 1500,
  })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Pedido pendente' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Pedido recusado' }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toHaveCount(0)
  const cart = await mockRequest<Cart>(page, '/cart')
  expect(cart.items).toHaveLength(1)
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(1)
  expect(orders[0].status).toBe('declined')
})

test('preço atualizado pelo domínio exige nova revisão e aceite', async ({
  page,
}) => {
  const { nft, edition } = await prepare(page)
  await review(page)
  await mockRequest(page, `/__mock/nfts/${nft.id}`, 'PATCH', {
    editionId: edition.id,
    priceEth: '7.125',
  })
  await expect(
    page.getByText(
      'Os preços ou a disponibilidade podem ter mudado. Atualize os valores antes de confirmar.',
    ),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Atualizar valores', exact: true })
    .click()
  await expect(
    page.getByText('As condições mudaram', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Confirmar compra', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Aceitar valores atualizados', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toContainText('7.125 ETH')
})

test('edição esgotada durante revisão impede envio', async ({ page }) => {
  const { nft, edition } = await prepare(page)
  await review(page)
  await mockRequest(page, `/__mock/nfts/${nft.id}`, 'PATCH', {
    editionId: edition.id,
    available: 0,
  })
  await expect(
    page.getByRole('button', {
      name: 'Confirmar compra',
      exact: true,
    }),
  ).toBeDisabled()
  await expect(
    page.getByText('Cotação indisponível', { exact: true }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(0)
})

test('cupom expirado na validação final impede envio e pode ser removido', async ({
  page,
}) => {
  await prepare(page)
  await page.getByLabel('Código promocional', { exact: true }).fill('KURIO10')
  await page.getByRole('button', { name: 'Aplicar cupom', exact: true }).click()
  await review(page)
  await scenario(page, { expiredCoupons: ['KURIO10'] })
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  await expect(
    page.getByText('Cotação indisponível', { exact: true }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(0)
  await page.getByRole('button', { name: 'Remover cupom', exact: true }).click()
  await expect(
    page.getByText('Cotação atualizada', { exact: true }),
  ).toBeVisible()
})

test('falha de conexão antes da criação mantém tentativa e permite retry após refresh', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'connection-error' })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Resultado desconhecido' }),
  ).toBeVisible()
  const saved = await page.evaluate(() =>
    localStorage.getItem('kurio:purchase:ana'),
  )
  expect(saved).toBeTruthy()
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(1)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Resultado desconhecido' }),
  ).toBeVisible()
  await scenario(page, { orderOutcome: 'confirmed' })
  await page
    .getByRole('button', { name: 'Recuperar ou repetir mesma tentativa' })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const final = await page.evaluate(() =>
    localStorage.getItem('kurio:purchase:ana'),
  )
  expect(JSON.parse(final!).key).toBe(JSON.parse(saved!).key)
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
})

test('sessão expirada durante checkout preserva destino e impede pedido', async ({
  page,
}) => {
  await prepare(page)
  await review(page)
  await scenario(page, {
    failures: [{ path: '/quotes', method: 'POST', status: 401, remaining: 1 }],
  })
  await page
    .getByRole('button', { name: 'Confirmar compra', exact: true })
    .click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
})

for (const width of [390, 768, 1440]) {
  test(`checkout e confirmação responsivos em ${width}px com teclado`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await prepare(page)
    await expect(page.getByTestId('purchase-total')).toBeVisible()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.onload = () => resolve()
                image.onerror = () => resolve()
              }),
        ),
      )
    })
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`checkout-${width}.png`),
      fullPage: true,
    })
    await page.getByRole('radio', { name: 'MetaMask', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('radio', { name: 'MetaMask', exact: true }),
    ).toBeFocused()
    await buy(page)
    await expect(
      page.getByRole('dialog', { name: 'Compra confirmada' }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`receipt-${width}.png`),
      fullPage: true,
    })
    const close = page.getByRole('button', {
      name: 'Fechar recibo',
      exact: true,
    })
    for (
      let step = 0;
      step < 10 &&
      !(await close.evaluate((element) => element === document.activeElement));
      step++
    )
      await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Ver detalhes do pedido', exact: true }),
    ).toBeFocused()
  })
}

test('duas compras consecutivas abrem pagamentos independentes sem reutilizar recibo', async ({
  page,
}) => {
  const { nft } = await prepare(page)
  await buy(page)
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const first = (await mockRequest<Order[]>(page, '/orders'))[0]
  const firstAttempt = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(0)
  const catalog = await mockRequest<NftList>(page, '/nfts?pageSize=24')
  const nextNft = catalog.items.find(
    (item) =>
      item.id !== nft.id &&
      item.network === 'ethereum' &&
      item.editions.some((value) => value.available >= 2),
  )!
  const nextEdition = nextNft.editions.find((value) => value.available >= 2)!
  await mockRequest<Cart>(page, '/cart/items', 'POST', {
    nftId: nextNft.id,
    editionId: nextEdition.id,
    quantity: 2,
  })
  await page.goto('/cart')
  await page
    .getByRole('link', { name: 'Finalizar compra', exact: true })
    .click()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toHaveCount(0)
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  expect((await mockRequest<Cart>(page, '/cart')).items[0].quantity).toBe(2)
  await page.reload()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  await buy(page)
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const secondAttempt = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  expect(secondAttempt.key).not.toBe(firstAttempt.key)
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(2)
  expect(new Set(orders.map((order) => order.id)).size).toBe(2)
  expect(orders.some((order) => order.id === first.id)).toBe(true)
  expect(
    orders.find((order) => order.id !== first.id)!.snapshot.lines[0].quantity,
  ).toBe(2)
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(0)
  await page.goto('/orders')
  for (const order of orders)
    await expect(page.getByText(order.id, { exact: true })).toBeVisible()
})

test('nova entrada pelo carrinho preserva pedido pendente e sua chave original', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, {
    orderOutcome: 'pending-confirmed',
    orderResolutionMs: 60000,
  })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Pedido pendente' }),
  ).toBeVisible()
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  await page.goto('/cart')
  await page
    .getByRole('link', { name: 'Finalizar compra', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Pedido pendente' }),
  ).toBeVisible()
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  expect(after).toEqual(before)
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(1)
})

test('nova entrada pelo carrinho preserva resultado desconhecido e recupera a mesma chave', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'connection-error' })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Resultado desconhecido' }),
  ).toBeVisible()
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  await page.goto('/cart')
  await page
    .getByRole('link', { name: 'Finalizar compra', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Resultado desconhecido' }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(0)
  await scenario(page, { orderOutcome: 'confirmed' })
  await page
    .getByRole('button', { name: 'Recuperar ou repetir mesma tentativa' })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  expect(after.key).toBe(before.key)
  expect(after.payload).toEqual(before.payload)
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(0)
})

test('tentativa recusada permite outra compra explícita com nova chave', async ({
  page,
}) => {
  await prepare(page)
  await scenario(page, { orderOutcome: 'declined' })
  await buy(page)
  await expect(
    page.getByRole('heading', { name: 'Pedido recusado' }),
  ).toBeVisible()
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  await page.goto('/cart')
  await page
    .getByRole('link', { name: 'Finalizar compra', exact: true })
    .click()
  await expect(
    page.getByLabel('Nome de exibição', { exact: true }),
  ).toBeVisible()
  expect(await mockRequest<Order[]>(page, '/orders')).toHaveLength(1)
  await scenario(page, { orderOutcome: 'confirmed' })
  await buy(page)
  await expect(
    page.getByRole('dialog', { name: 'Compra confirmada' }),
  ).toBeVisible()
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kurio:purchase:ana')!),
  )
  expect(after.key).not.toBe(before.key)
  const orders = await mockRequest<Order[]>(page, '/orders')
  expect(orders).toHaveLength(2)
  expect(orders.map((order) => order.status).sort()).toEqual([
    'confirmed',
    'declined',
  ])
  expect((await mockRequest<Cart>(page, '/cart')).items).toHaveLength(0)
})
