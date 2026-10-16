import { test, expect } from '@playwright/test'
test('Axios HTTP e Socket.IO são interceptados por MSW no navegador', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const responsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/diagnostics',
  )
  await page.goto('/diagnostics')
  const response = await responsePromise
  expect(response.fromServiceWorker()).toBe(true)
  expect(response.headers()['x-kurio-mock']).toBe('msw')
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await expect(page.getByTestId('socket-status')).toHaveText(
    'Socket.IO conectado',
  )
  await expect(page.getByTestId('socket-payload')).toContainText(
    'msw-socket.io',
  )
  await expect(page.getByTestId('socket-payload')).toContainText('requestId')
  const repeatedResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/diagnostics',
  )
  await page.getByRole('button', { name: 'Repetir HTTP' }).click()
  expect((await repeatedResponse).fromServiceWorker()).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({
    path: test.info().outputPath('diagnostics.png'),
    fullPage: true,
  })
})

test('heartbeat mantém o transporte Socket.IO ativo', async ({ page }) => {
  test.setTimeout(45_000)
  await page.goto('/diagnostics')
  await expect(page.getByTestId('socket-status')).toHaveText(
    'Socket.IO conectado',
  )
  await page.waitForTimeout(31_000)
  await expect(page.getByTestId('socket-status')).toHaveText(
    'Socket.IO conectado',
  )
})
test('rota inexistente exibe fallback e permite retornar', async ({ page }) => {
  await page.goto('/nao-existe')
  await expect(
    page.getByRole('heading', { name: 'Página não encontrada' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
})
