/**
 * E2E-тесты шерабельных ссылок /feed
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

/**
 * Логин через UI модалку с главной страницы.
 * Все действия происходят через фронтенд, токен пишется в localStorage самим приложением.
 */
async function loginViaUi(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.click('button:has-text("Войти")')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  // Ждём закрытия модалки — после успеха AuthModal вызывает onClose() + navigate(savedUrl)
  await page.waitForSelector('input[type="email"]', { state: 'detached', timeout: 15_000 })
}

test.describe('/feed shareable URLs', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page)
    await page.goto('/feed')
    await expect(page.locator('button:has-text("Все")')).toBeVisible()
  })

  test('TC-F1: selecting a tag writes ?tag= to URL', async ({ page }) => {
    await page.click('button:has-text("Сбербанк")')
    await expect(page).toHaveURL(/tag=/)
  })

  test('TC-F3: search writes ?q= to URL after debounce', async ({ page }) => {
    await page.fill('input[placeholder="Поиск по новостям..."]', 'дивиденды')
    await expect(page).toHaveURL(/q=/, { timeout: 1_500 })
  })

  test('TC-F5: tag + search both in URL', async ({ page }) => {
    await page.click('button:has-text("Сбербанк")')
    await expect(page).toHaveURL(/tag=/)
    await page.fill('input[placeholder="Поиск по новостям..."]', 'дивиденды')
    await expect(page).toHaveURL(/tag=/)
    await expect(page).toHaveURL(/q=/, { timeout: 1_500 })
  })

  test('TC-F6: "Все" clears tag but preserves search query', async ({ page }) => {
    await page.click('button:has-text("Сбербанк")')
    await page.fill('input[placeholder="Поиск по новостям..."]', 'дивиденды')
    await expect(page).toHaveURL(/tag=/)
    await expect(page).toHaveURL(/q=/, { timeout: 1_500 })

    await page.click('button:has-text("Все")')
    await expect(page).not.toHaveURL(/tag=/)
    await expect(page).toHaveURL(/q=/)
  })

  test('TC-F7: clearing search yields clean /feed', async ({ page }) => {
    await page.fill('input[placeholder="Поиск по новостям..."]', 'дивиденды')
    await expect(page).toHaveURL(/q=/, { timeout: 1_500 })

    await page.fill('input[placeholder="Поиск по новостям..."]', '')
    await expect(page).toHaveURL('/feed', { timeout: 1_500 })
  })

  test('TC-F8: back/forward across filters', async ({ page }) => {
    // Тег пишется через push, поэтому в истории появляется отдельная запись.
    await page.click('button:has-text("Сбербанк")')
    await expect(page).toHaveURL(/tag=/, { timeout: 1_500 })

    await page.click('button:has-text("Все")')
    await expect(page).toHaveURL('/feed', { timeout: 1_500 })

    await page.goBack()
    await expect(page).toHaveURL(/tag=/)

    await page.goForward()
    await expect(page).toHaveURL('/feed')
  })

  test('TC-F10: unknown tag falls back to search query', async ({ page }) => {
    const unknownTag = 'НесуществующийТег12345'
    await page.goto(`/feed?tag=${encodeURIComponent(unknownTag)}`)
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/q=/)
    await expect(page.locator('input[placeholder="Поиск по новостям..."]')).toHaveValue(unknownTag)
  })
})

test.describe('/feed post-auth return redirect', () => {
  test('TC-R2: guest opens shared /feed link, logs in, returns to it', async ({ page }) => {
    await page.goto('/feed?tag=Сбербанк&q=дивиденды')
    await page.waitForSelector('button:has-text("Войти")')

    await page.click('button:has-text("Войти")')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // После успешного логина модалка закрывается и происходит редирект на исходную ссылку.
    await expect(page).toHaveURL(/tag=/, { timeout: 15_000 })
    await expect(page).toHaveURL(/q=/)
  })
})
