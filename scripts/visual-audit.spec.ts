import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { resetMocks } from '../tests/helpers.js'
import { p4Request as request } from '../tests/phase4-helpers.js'
import type {
  Session,
  Quote,
  Wallet,
  Order,
} from '../src/shared/contracts/marketplace.js'

const screens = [
  'home',
  'details',
  'cart',
  'checkout',
  'confirmation',
  'login',
  'register',
  'profile',
  'wallets',
  'favorites',
  'activity',
] as const
const paths = {
  home: '/',
  details: '/nfts/emerald-ape',
  cart: '/cart',
  checkout: '/checkout',
  confirmation: '/checkout',
  login: '/login',
  register: '/register',
  profile: '/profile',
  wallets: '/wallets',
  favorites: '/favorites',
  activity: '/orders',
}
for (const width of [390, 768, 1440])
  for (const screen of screens)
    test(`${screen} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await resetMocks(page)
      await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))
      await request(page, '/__mock/scenario', 'PATCH', { latencyMs: 0 })
      const authenticated = [
        'checkout',
        'confirmation',
        'profile',
        'wallets',
        'favorites',
        'activity',
      ].includes(screen)
      if (authenticated) {
        const session = await request<Session>(page, '/auth/login', 'POST', {
          email: 'ana@kurio.demo',
          password: 'Kurio123!',
        })
        await page.evaluate(
          (token) => localStorage.setItem('kurio.accessToken', token!),
          session.accessToken,
        )
      }
      if (['cart', 'checkout', 'confirmation', 'activity'].includes(screen))
        await request(page, '/cart/items', 'POST', {
          nftId: 'emerald-ape',
          editionId: 'emerald-ape-standard',
          quantity: 2,
        })
      if (screen === 'favorites')
        await request(page, '/favorites/emerald-ape', 'PUT')
      if (screen === 'activity') {
        const quote = await request<Quote>(page, '/quotes', 'POST', {
          network: 'ethereum',
        })
        const wallets = await request<Wallet[]>(page, '/wallets')
        await request<Order>(
          page,
          '/orders',
          'POST',
          { quoteId: quote.id, walletId: wallets[0]!.id, network: 'ethereum' },
          'audit-activity',
        )
      }
      await page.goto(paths[screen])
      const ready = {
        home: page.getByTestId('catalog-grid'),
        details: page.locator('.product-information'),
        cart: page.getByTestId('quote-status'),
        checkout: page.getByRole('button', {
          name: 'Confirmar compra',
          exact: true,
        }),
        confirmation: page.getByRole('button', {
          name: 'Confirmar compra',
          exact: true,
        }),
        login: page.getByLabel('E-mail', { exact: true }),
        register: page.getByLabel('E-mail', { exact: true }),
        profile: page.getByRole('button', {
          name: 'Salvar perfil',
          exact: true,
        }),
        wallets: page.getByRole('button', {
          name: 'Salvar carteira',
          exact: true,
        }),
        favorites: page.getByTestId('catalog-card'),
        activity: page.getByRole('link', { name: 'Ver pedido', exact: true }),
      }
      await expect(ready[screen].first()).toBeVisible()
      if (screen === 'confirmation') {
        await page.getByRole('radio', { name: 'MetaMask', exact: true }).click()
        await page
          .getByRole('button', {
            name: 'Conectar carteira',
            exact: true,
          })
          .click()
        await page
          .getByRole('button', { name: 'Confirmar compra', exact: true })
          .click()
        await expect(
          page.getByRole('dialog', { name: 'Compra confirmada' }),
        ).toBeVisible()
      }
      await page.evaluate(async () => {
        await document.fonts.ready
        if (!document.querySelector('[role="dialog"]')) {
          for (
            let y = 0;
            y < document.documentElement.scrollHeight;
            y += innerHeight
          ) {
            window.scrollTo(0, y)
            await new Promise((resolve) => requestAnimationFrame(resolve))
          }
          window.scrollTo(0, 0)
        }
        await Promise.all(
          [...document.images]
            .filter((image) => {
              if (image.loading !== 'lazy') return true
              const box = image.getBoundingClientRect()
              return box.width > 0 && box.left < innerWidth && box.right > 0
            })
            .map((image) => {
              image.loading = 'eager'
              return image.decode().catch(() => undefined)
            }),
        )
      })
      const directory = resolve(
        'reports/phase-5',
        process.env.KURIO_AUDIT_STAGE || 'after',
      )
      await mkdir(directory, { recursive: true })
      await page.screenshot({
        path: resolve(directory, `${screen}-${width}-viewport.png`),
      })
      await page.screenshot({
        path: resolve(directory, `${screen}-${width}-full.png`),
        fullPage: true,
      })
      await writeFile(
        resolve(directory, `${screen}-${width}.json`),
        JSON.stringify(
          await page.evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            images: [...document.images]
              .filter((image) => image.getBoundingClientRect().width > 0)
              .map((image) => ({
                src: image.getAttribute('src'),
                naturalWidth: image.naturalWidth,
                width: image.getBoundingClientRect().width,
                height: image.getBoundingClientRect().height,
                top: image.getBoundingClientRect().top,
              })),
            headings: [...document.querySelectorAll('h1,h2')].map(
              (node) => node.textContent,
            ),
            controls: [...document.querySelectorAll('input,select,button')]
              .filter((node) => (node as HTMLElement).offsetWidth > 0)
              .map((node) => ({
                label:
                  node.getAttribute('aria-label') || node.textContent?.trim(),
                box: {
                  width: node.getBoundingClientRect().width,
                  height: node.getBoundingClientRect().height,
                },
                background: getComputedStyle(node).backgroundColor,
                font: getComputedStyle(node).fontFamily,
              })),
          })),
          null,
          2,
        ),
      )
      if (screen === 'details') {
        await page
          .getByRole('tab', { name: /Avaliações de colecionadores/ })
          .click()
        await page.getByRole('tabpanel').scrollIntoViewIfNeeded()
        await page
          .locator('.collector-reviews img')
          .evaluateAll(async (images) =>
            Promise.all(
              images.map((image) => (image as HTMLImageElement).decode()),
            ),
          )
        await page.screenshot({
          path: resolve(directory, `details-reviews-${width}-viewport.png`),
        })
        await page.screenshot({
          path: resolve(directory, `details-reviews-${width}-full.png`),
          fullPage: true,
        })
      }
    })

if (process.env.KURIO_AUDIT_STAGE !== 'before')
  for (const width of [390, 1440])
    for (const state of [
      'catalog-loading',
      'catalog-error',
      'catalog-empty',
      'cart-empty',
      'favorites-empty',
      'checkout-no-wallet',
    ]) {
      test(`${state} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await resetMocks(page)
        await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))
        await request(page, '/__mock/scenario', 'PATCH', {
          latencyMs: 0,
          responseDelays:
            state === 'catalog-loading'
              ? [{ path: '/nfts', method: 'GET', delayMs: 5000, remaining: 20 }]
              : [],
          failures:
            state === 'catalog-error'
              ? [{ path: '/nfts', method: 'GET', status: 503, remaining: 20 }]
              : [],
        })
        if (['favorites-empty', 'checkout-no-wallet'].includes(state)) {
          const session = await request<Session>(page, '/auth/login', 'POST', {
            email:
              state === 'checkout-no-wallet'
                ? 'bruno@kurio.demo'
                : 'ana@kurio.demo',
            password: 'Kurio123!',
          })
          await page.evaluate(
            (token) => localStorage.setItem('kurio.accessToken', token!),
            session.accessToken,
          )
        }
        if (state === 'checkout-no-wallet')
          await request(page, '/cart/items', 'POST', {
            nftId: 'sage-nomad',
            editionId: 'sage-nomad-standard',
            quantity: 1,
          })
        await page.goto(
          state === 'cart-empty'
            ? '/cart'
            : state === 'favorites-empty'
              ? '/favorites'
              : state === 'checkout-no-wallet'
                ? '/checkout'
                : state === 'catalog-empty'
                  ? '/?q=sem-resultado-auditoria'
                  : '/',
        )
        if (state === 'catalog-loading')
          await expect(
            page.getByTestId('catalog-skeleton').first(),
          ).toBeVisible()
        if (state === 'catalog-error')
          await expect(page.getByTestId('catalog-error')).toBeVisible()
        if (state === 'catalog-empty')
          await expect(page.getByTestId('catalog-empty')).toBeVisible()
        if (state === 'cart-empty')
          await expect(
            page.getByRole('heading', { name: 'Seu carrinho está vazio' }),
          ).toBeVisible()
        if (state === 'favorites-empty')
          await expect(
            page.getByRole('heading', { name: 'Seus favoritos' }),
          ).toBeVisible()
        if (state === 'checkout-no-wallet')
          await expect(page.getByRole('alert')).toContainText(
            'Cadastre uma carteira Polygon',
          )
        if (state.startsWith('catalog-'))
          await page.locator('#catalog').scrollIntoViewIfNeeded()
        const directory = resolve(
          'reports/phase-5',
          process.env.KURIO_AUDIT_STAGE || 'after',
        )
        await mkdir(directory, { recursive: true })
        await page.screenshot({
          path: resolve(directory, `${state}-${width}-viewport.png`),
        })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
      })
    }
