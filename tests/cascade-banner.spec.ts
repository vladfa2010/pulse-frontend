/**
 * E2E-тесты баннера «Тест каскадов и сюжетов» (ТЗ-47)
 *
 * Целевой стенд по умолчанию — продакшен-фронтенд:
 *   https://pulse-frontend-jt53.onrender.com
 * Настраивается через PW_BASE_URL (см. playwright.config.ts).
 *
 * Тестовый аккаунт (из ТЗ):
 *   Email:    vladfa@ya2.ru
 *   Password: !1234567890
 */
import { test, expect } from '@playwright/test'

const EMAIL = 'vladfa@ya2.ru'
const PASSWORD = '!1234567890'

const BANNER = '.cascade-test-banner'

async function loginViaUi(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.click('button:has-text("Войти")')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForSelector('input[type="email"]', { state: 'detached', timeout: 15_000 })
}

test.describe('CascadeTestBanner (ТЗ-47)', () => {
  test('TC-C1: гость на / баннера не видит (и в DOM его нет)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(BANNER)).toHaveCount(0)
  })

  test('TC-C2: авторизованный видит баннер внизу главной, карточка — ссылка на прототип', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/')
    const banner = page.locator(BANNER)
    await expect(banner).toBeVisible()

    // Критерий 2: вся карточка — внешняя ссылка в новой вкладке
    await expect(banner).toHaveAttribute('href', 'https://j5gsuigoi6jro.kimi.page')
    await expect(banner).toHaveAttribute('target', '_blank')
    const rel = await banner.getAttribute('rel')
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')

    // Критерий 1: тексты 1:1 по мокапу
    await expect(banner).toContainText('Прототип · тест')
    await expect(banner).toContainText('Тест каскадов и сюжетов.')
    await expect(banner).toContainText('Какой источник дает первую информацию')
    await expect(banner).toContainText('Смотрите, кто публикует новость первым и с каким отставанием идут дубли — на живом графике каскада. Оцените прототип и оставьте фидбек.')
    await expect(banner).toContainText('Открыть прототип →')

    // Критерий 1: баннер — последний блок страницы
    const isLastBlock = await banner.evaluate((el) => {
      const section = el.closest('section')
      return !!section && section.nextElementSibling === null
    })
    expect(isLastBlock).toBe(true)
  })

  test('TC-C3: на /feed баннера нет', async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/feed')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(BANNER)).toHaveCount(0)
  })

  test('TC-C4: мобильная ширина 375px — вёрстка адаптивна, кнопка ≥44px', async ({ page }) => {
    // Логинимся на десктопном вьюпорте (на 375px кнопка «Войти» в мобильном меню),
    // затем ресайзим — токен живёт в localStorage.
    await loginViaUi(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const banner = page.locator(BANNER)
    await expect(banner).toBeVisible()

    // Заголовок 22px на ≤900px
    const titleSize = await banner.locator('h3').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(titleSize).toBe(22)

    // Кнопка не растянута на всю ширину и ≥44px по высоте
    const btn = banner.locator('.cascade-test-banner__btn')
    const btnBox = await btn.boundingBox()
    const bannerBox = await banner.boundingBox()
    expect(btnBox!.height).toBeGreaterThanOrEqual(44)
    expect(btnBox!.width).toBeLessThan(bannerBox!.width - 20)
  })
})
