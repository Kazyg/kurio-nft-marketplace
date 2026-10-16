import { expect, test } from '@playwright/test'
import { resetMocks, scenario } from './helpers.js'

test('imports de rotas não geram erros de execução ou suspensão React', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /incorrect use of use|use\(\) to suspend|dynamically imported module/.test(
        message.text(),
      )
    )
      errors.push(message.text())
  })
  await resetMocks(page)
  await scenario(page, { latencyMs: 0 })
  for (const [path, ready] of [
    ['/', '[data-testid="catalog-grid"]'],
    ['/nfts/emerald-ape', '.product-information'],
    ['/cart', '.cart-empty'],
    ['/login', '.auth-form'],
  ]) {
    await page.goto(path!)
    await expect(page.locator(ready!).first()).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('latência de transporte não serializa requisições HTTP independentes', async ({
  page,
}) => {
  await resetMocks(page)
  await scenario(page, { latencyMs: 2000 })
  const result = await page.evaluate(async () => {
    const started = performance.now()
    const responses = await Promise.all(
      ['/catalog/content', '/nfts', '/auth/session'].map((path) =>
        fetch(`/api${path}`),
      ),
    )
    await Promise.all(responses.map((response) => response.json()))
    return {
      elapsed: performance.now() - started,
      statuses: responses.map((response) => response.status),
    }
  })
  expect(result.statuses).toEqual([200, 200, 200])
  expect(result.elapsed).toBeGreaterThanOrEqual(2000)
  expect(result.elapsed).toBeLessThan(4000)
})
