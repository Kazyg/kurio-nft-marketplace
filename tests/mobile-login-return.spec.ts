import { expect, test, type Page } from '@playwright/test'
import { resetMocks } from './helpers.js'

async function homeState(page: Page) {
  await expect(page.getByTestId('catalog-grid')).toBeVisible()
  await expect(page.locator('.hero:not(.hero-placeholder)')).toBeVisible()
  await page.evaluate(() => scrollTo(0, 0))
  return page.evaluate(() => {
    const hero = document.querySelector('.hero')!.getBoundingClientRect()
    const search = document
      .querySelector('.catalog-search')!
      .getBoundingClientRect()
    return {
      rootClass: document.querySelector('.marketplace')!.className,
      hero: { width: hero.width, height: hero.height, x: hero.x },
      searchWidth: search.width,
      columns: getComputedStyle(
        document.querySelector('[data-testid="catalog-grid"]')!,
      ).gridTemplateColumns,
      bodyOverflow: getComputedStyle(document.body).overflow,
      pointerEvents: getComputedStyle(document.body).pointerEvents,
      lock: document.body.getAttribute('data-scroll-locked'),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }
  })
}

for (const width of [390, 414, 768]) {
  for (const via of ['link', 'history'])
    test(`mobile volta do login em ${width}px via ${via}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await resetMocks(page)
      await page.goto('/')
      const before = await homeState(page)
      await page.evaluate(() => {
        document.documentElement.dataset.returnMarker = 'retained'
      })
      await page
        .getByRole('button', { name: 'Meu perfil', exact: true })
        .click()
      await expect(page).toHaveURL(/\/login/)
      if (via === 'history') await page.goBack()
      else if (width < 768)
        await page.getByRole('link', { name: '← Voltar' }).click()
      else {
        await expect(
          page.getByRole('dialog', { name: 'Entrar na Kurio' }),
        ).toBeVisible()
        await page.keyboard.press('Escape')
      }
      await expect(page).toHaveURL((url) => url.pathname === '/')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate(() => document.body.getAttribute('data-scroll-locked')),
        )
        .toBeNull()
      const after = await homeState(page)
      expect(after).toEqual(before)
      expect(
        await page.evaluate(
          () => document.documentElement.dataset.returnMarker,
        ),
      ).toBe('retained')
    })
}

test('alternar entre modal e página de login libera scroll e preserva a Home', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await resetMocks(page)
  await page.goto('/')
  const before = await homeState(page)
  await page.getByRole('button', { name: 'Meu perfil', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.setViewportSize({ width: 1024, height: 844 })
  await expect(
    page.getByRole('dialog', { name: 'Entrar na Kurio' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() => document.body.getAttribute('data-scroll-locked')),
    )
    .toBeNull()
  await page.getByRole('link', { name: '← Voltar' }).click()
  await expect(page).toHaveURL((url) => url.pathname === '/')
  expect(await homeState(page)).toEqual(before)
})

test('cancelar login após favorito mobile restaura a busca e o layout sem recarregar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await resetMocks(page)
  await page.goto('/?q=Emerald')
  const before = await homeState(page)
  await page.evaluate(() => {
    document.documentElement.dataset.returnMarker = 'retained'
  })
  await page
    .getByTestId('catalog-card')
    .first()
    .getByRole('button', { name: /^Favoritar/ })
    .click()
  await expect(page).toHaveURL(/\/login/)
  expect(
    await page.evaluate(() => sessionStorage.getItem('kurio.pendingFavorite')),
  ).not.toBeNull()
  await page.getByRole('link', { name: '← Voltar' }).click()
  await expect(page).toHaveURL(/q=Emerald/)
  await expect(page.getByLabel('Buscar NFTs', { exact: true })).toHaveValue(
    'Emerald',
  )
  expect(await homeState(page)).toEqual(before)
  expect(
    await page.evaluate(() => document.documentElement.dataset.returnMarker),
  ).toBe('retained')
  expect(
    await page.evaluate(() => sessionStorage.getItem('kurio.pendingFavorite')),
  ).toBeNull()
})
