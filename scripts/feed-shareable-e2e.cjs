#!/usr/bin/env node
/**
 * =============================================================================
 * E2E smoke-тесты шерабельных ссылок /feed
 * =============================================================================
 *
 * Запуск:
 *   1. npm run dev (frontend должен быть на http://localhost:5173)
 *   2. node scripts/feed-shareable-e2e.cjs
 */

const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const FRONTEND = 'http://localhost:5173'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EMAIL = 'vladfa@ya2.ru'
const PASSWORD = '!1234567890'

const TEST_TAG = 'Сбербанк'
const TEST_TAG_ID = 'sber'
const TEST_QUERY = 'дивиденды'

let passed = 0
let failed = 0

function assert(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`✅ ${name}`)
  } else {
    failed++
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function screenshot(page, name) {
  const dir = path.join(__dirname, '..', 'screenshots')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `feed-e2e-${name}.png`), fullPage: true })
}

async function findButtonByText(page, text, timeout = 10000) {
  return page.waitForFunction(
    (t) => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.find(b => b.textContent.trim() === t) || null
    },
    { timeout },
    text
  )
}

async function login(page) {
  // Если auth-стена с кнопкой "Войти" — открываем модалку
  const hasGuestButton = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Войти')
  })
  if (hasGuestButton) {
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Войти')
      if (b) b.click()
    })
    await wait(300)
  }

  await page.waitForSelector('input[type="email"]', { visible: true, timeout: 10000 })
  await page.type('input[type="email"]', EMAIL)
  await page.type('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // Ждём, пока модалка закроется и появится лента
  await page.waitForFunction(() => {
    return !document.querySelector('input[type="email"]') &&
           document.querySelector('input[placeholder="Поиск по новостям..."]') !== null
  }, { timeout: 15000 })
}

async function getCurrentUrlPath(page) {
  const url = new URL(page.url())
  return url.pathname + url.search
}

async function waitForTagButtons(page, timeout = 15000) {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Все')
  }, { timeout })
}

(async () => {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    page.setDefaultTimeout(20000)

    // ═══════════════════════════════════════════════════════════════════════
    // Блок A: синхронизация URL на /feed (залогиненный пользователь)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- Блок A: /feed URL sync ---\n')

    await page.goto(`${FRONTEND}/feed`)
    await login(page)
    await waitForTagButtons(page)

    // TC-F1: выбор тега пишется в URL
    await page.evaluate((tag) => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === tag)
      if (b) b.click()
    }, TEST_TAG)
    await wait(500)
    const urlAfterTag = await getCurrentUrlPath(page)
    assert('TC-F1: выбор тега пишется в URL', urlAfterTag.includes('tag='), urlAfterTag)
    await screenshot(page, 'tc-f1-tag-selected')

    // TC-F3: поиск пишется в URL с debounce
    const input = await page.$('input[placeholder="Поиск по новостям..."]')
    await input.focus()
    await page.keyboard.type(TEST_QUERY)
    // ждём debounce 400 мс + небольшой запас
    await wait(900)
    const urlAfterSearch = await getCurrentUrlPath(page)
    assert('TC-F3: поиск пишется в URL с debounce', urlAfterSearch.includes('q='), urlAfterSearch)

    // TC-F5: tag + search одновременно
    assert('TC-F5: tag + search в URL одновременно', urlAfterSearch.includes('tag=') && urlAfterSearch.includes('q='), urlAfterSearch)

    // TC-F6: кнопка "Все" сбрасывает только тег
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Все')
      if (b) b.click()
    })
    await wait(500)
    const urlAfterAll = await getCurrentUrlPath(page)
    assert('TC-F6: "Все" убирает tag, но сохраняет q', !urlAfterAll.includes('tag=') && urlAfterAll.includes('q='), urlAfterAll)

    // TC-F7: полная очистка → чистый URL
    await input.evaluate(el => {
      el.focus()
      el.select()
    })
    await wait(100)
    await page.keyboard.press('Backspace')
    await wait(900)
    const inputValueAfterClear = await page.evaluate(() => {
      const el = document.querySelector('input[placeholder="Поиск по новостям..."]')
      return el ? el.value : null
    })
    console.log('  [debug] input value after clear:', JSON.stringify(inputValueAfterClear))
    await screenshot(page, 'tc-f7-after-clear')
    const urlAfterClear = await getCurrentUrlPath(page)
    assert('TC-F7: полная очистка → чистый /feed', urlAfterClear === '/feed', urlAfterClear)

    // TC-F8: back/forward по фильтрам
    await page.goBack()
    await wait(500)
    const urlBack = await getCurrentUrlPath(page)
    assert('TC-F8: "назад" возвращает q', urlBack.includes('q='), urlBack)

    await page.goForward()
    await wait(500)
    const urlForward = await getCurrentUrlPath(page)
    assert('TC-F8: "вперёд" возвращает чистый /feed', urlForward === '/feed', urlForward)

    // TC-F10: чужой тег → fallback в поиск
    const unknownTag = 'НесуществующийТег12345'
    await page.goto(`${FRONTEND}/feed?tag=${encodeURIComponent(unknownTag)}`)
    await waitForTagButtons(page)
    await wait(1200)
    const urlUnknown = await getCurrentUrlPath(page)
    const inputValue = await page.evaluate(() => {
      const el = document.querySelector('input[placeholder="Поиск по новостям..."]')
      return el ? el.value : null
    })
    assert('TC-F10: чужой тег превращается в q', urlUnknown.includes('q=') && urlUnknown.includes(encodeURIComponent(unknownTag).replace(/-/g, '%20')), urlUnknown)
    assert('TC-F10: значение поиска совпадает с именем чужого тега', inputValue === unknownTag, String(inputValue))

    // ═══════════════════════════════════════════════════════════════════════
    // Блок B: платформенный возврат после входа
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n--- Блок B: post-auth return redirect ---\n')

    // Разлогиниваемся
    await page.evaluate(() => {
      localStorage.removeItem('pulse_token')
      window.dispatchEvent(new CustomEvent('auth:logout'))
    })
    await page.goto(`${FRONTEND}/feed?tag=${encodeURIComponent(TEST_TAG)}&q=${encodeURIComponent(TEST_QUERY)}`)
    await wait(1000)

    // Проверяем, что показан экран гостя и есть кнопка "Войти"
    const loginButton = await page.$('button::-p-text(Войти)')
    assert('TC-R2: гость на /feed?tag=... видит кнопку "Войти"', !!loginButton)
    await screenshot(page, 'tc-r2-guest-feed')

    if (loginButton) {
      await loginButton.click()
      await login(page)
      const urlAfterLogin = await getCurrentUrlPath(page)
      assert('TC-R2: после логина редирект на исходную /feed с параметрами', urlAfterLogin.includes('tag=') && urlAfterLogin.includes('q='), urlAfterLogin)
      await screenshot(page, 'tc-r2-after-login')
    }

    console.log(`\n--- Итог: ${passed} passed, ${failed} failed ---\n`)
    process.exit(failed > 0 ? 1 : 0)
  } catch (err) {
    console.error('E2E test crashed:', err)
    if (browser) {
      try {
        const page = (await browser.pages())[0]
        if (page) await screenshot(page, 'crash')
      } catch {}
    }
    process.exit(1)
  } finally {
    if (browser) await browser.close()
  }
})()
