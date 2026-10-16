import { expect, test, type Page } from '@playwright/test'
import { resetMocks } from '../tests/helpers.js'
import { p4Request as request } from '../tests/phase4-helpers.js'
import type { Session } from '../src/shared/contracts/marketplace.js'

const paths = {
  home: '/',
  details: '/nfts/emerald-ape',
  cart: '/cart',
  checkout: '/checkout',
} as const

async function prepareImagesAndFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const images = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    })
    await Promise.all(
      images.map(async (image) => {
        image.loading = 'eager'
        await image.decode()
        if (image.naturalWidth === 0)
          throw new Error(`Imagem não carregada: ${image.currentSrc}`)
      }),
    )
  })
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check('400 14px "Roboto Mono"')),
    )
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
}

for (const screen of Object.keys(paths) as (keyof typeof paths)[])
  test(screen, async ({ page }) => {
    await resetMocks(page)
    await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))
    await request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
    if (screen === 'checkout') {
      const session = await request<Session>(page, '/auth/login', 'POST', {
        email: 'ana@kurio.demo',
        password: 'Kurio123!',
      })
      await page.evaluate(
        (token) => localStorage.setItem('kurio.accessToken', token!),
        session.accessToken,
      )
    }
    if (screen === 'cart' || screen === 'checkout')
      await request(page, '/cart/items', 'POST', {
        nftId: 'emerald-ape',
        editionId: 'emerald-ape-standard',
        quantity: 2,
      })
    await page.goto(paths[screen])
    if (screen === 'home')
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
    if (screen === 'home' && page.viewportSize()!.width >= 1024)
      await expect(
        page.getByRole('slider', { name: 'Preço mínimo no slider' }),
      ).toBeVisible()
    if (screen === 'details')
      await expect(page.locator('.product-information')).toBeVisible()
    if (screen === 'cart')
      await expect(page.getByTestId('quote-status')).toContainText(
        'Cotação atualizada',
      )
    if (screen === 'checkout')
      await expect(
        page.getByRole('button', {
          name: 'Confirmar compra: revisar valores',
          exact: true,
        }),
      ).toBeVisible()
    await prepareImagesAndFonts(page)
    await expect(page).toHaveScreenshot(`${screen}-viewport.png`)
    await expect(page).toHaveScreenshot(`${screen}-full.png`, {
      fullPage: true,
    })
  })
