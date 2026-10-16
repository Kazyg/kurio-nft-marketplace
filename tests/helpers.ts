import { expect, type Page } from '@playwright/test'
import type { MockScenario } from '../src/shared/contracts/marketplace.js'

export async function mockRequest<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('kurio.accessToken')
            ? {
                Authorization: `Bearer ${localStorage.getItem('kurio.accessToken')}`,
              }
            : {}),
          ...(localStorage.getItem('kurio.guestId')
            ? { 'X-Guest-Id': localStorage.getItem('kurio.guestId')! }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
      return response.json()
    },
    { path, method, body },
  ) as Promise<T>
}

export async function resetMocks(page: Page) {
  await page.goto('/diagnostics')
  await expect(page.getByTestId('http-status')).toHaveText('HTTP conectado')
  await mockRequest(page, '/__mock/reset', 'POST')
  await page.evaluate(() => localStorage.clear())
}

export async function scenario(page: Page, value: Partial<MockScenario>) {
  return mockRequest<MockScenario>(page, '/__mock/scenario', 'PATCH', value)
}
