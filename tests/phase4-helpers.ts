import type { Page } from '@playwright/test'
import type { AxiosStatic } from 'axios'
import { resolve } from 'node:path'

export async function p4Response<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
  timeout = 10000,
): Promise<{ status: number; data: T }> {
  await page.locator('#main-content').waitFor({ state: 'attached' })
  if (!(await page.evaluate(() => 'axios' in window)))
    await page.addScriptTag({
      path: resolve('node_modules/axios/dist/axios.min.js'),
    })
  return page.evaluate(
    async ({ path, method, body, key, timeout }) => {
      const axios = (window as unknown as { axios: AxiosStatic }).axios
      const token = localStorage.getItem('kurio.accessToken')
      const guest = localStorage.getItem('kurio.guestId') || crypto.randomUUID()
      localStorage.setItem('kurio.guestId', guest)
      const response = await axios.request<T>({
        url: `/api${path}`,
        method,
        data: body,
        timeout,
        validateStatus: () => true,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(guest ? { 'X-Guest-Id': guest } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
      })
      return { status: response.status, data: response.data }
    },
    { path, method, body, key, timeout },
  )
}

export async function p4Request<T>(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  const result = await p4Response<T>(page, path, method, body, key)
  if (result.status >= 400)
    throw new Error(
      `${method} ${path}: ${result.status} ${JSON.stringify(result.data)}`,
    )
  return result.data
}
