const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const API_BASE = 'https://pulse-api-bsov.onrender.com'
const FRONTEND = 'https://pulse-frontend-jt53.onrender.com'
const EMAIL = 'vladfa@ya12.ru'
const PASSWORD = '!1234567890'

const outDir = path.resolve('screenshots')
fs.mkdirSync(outDir, { recursive: true })

const logLines = []
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  logLines.push(line)
  console.log(line)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  const data = await res.json()
  return data.token
}

async function navigateSPA(page, pathname) {
  await page.evaluate((p) => {
    window.history.pushState(null, '', p)
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
  }, pathname)
  await sleep(1500)
}

async function run() {
  const token = await login()
  log('JWT token obtained')

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

    const requests = []
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/news') || url.includes('/api/auth')) {
        requests.push({ t: Date.now(), url, method: req.method() })
        log(`[NET] ${req.method()} ${url}`)
      }
    })

    const consoleMsgs = []
    page.on('console', (msg) => {
      const text = msg.text()
      consoleMsgs.push({ t: Date.now(), type: msg.type(), text })
      if (text.includes('[SSE]') || text.includes('Encountered') || text.includes('Failed') || text.includes('No routes matched') || msg.type() === 'error') {
        log(`[CONSOLE ${msg.type()}] ${text.slice(0, 240)}`)
      }
    })

    await page.goto(`${FRONTEND}/`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.evaluate((t) => { localStorage.setItem('pulse_token', t) }, token)
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    log('Home reloaded with token')

    await page.waitForSelector('[data-news-id], [data-flip-id]', { timeout: 20000 })
    await sleep(3000)
    await page.screenshot({ path: path.join(outDir, 'home-initial.png'), fullPage: true })
    log('Screenshot home-initial.png saved')

    // Immediate quick round-trip (within stale window, before any SSE refresh)
    const requestsBeforeImmediate = requests.length
    log('SPA navigate to /profile immediately')
    await navigateSPA(page, '/profile')
    await sleep(500)
    log('SPA navigate back to / immediately')
    await navigateSPA(page, '/')
    await page.waitForSelector('[data-news-id], [data-flip-id]', { timeout: 20000 })
    await sleep(1000)

    const immediateRequests = requests.slice(requestsBeforeImmediate)
    const immediateGlobal = immediateRequests.filter(r => r.url.includes('/api/news/global') && r.method !== 'OPTIONS')
    log(`Immediate round-trip: ${immediateGlobal.length} /api/news/global requests (expected 0)`)

    // Slightly delayed quick round-trip (still within 30s)
    const requestsBeforeQuick = requests.length
    log('SPA navigate to /profile (quick)')
    await navigateSPA(page, '/profile')
    await sleep(2000)
    log('SPA navigate back to / (quick)')
    await navigateSPA(page, '/')
    await page.waitForSelector('[data-news-id], [data-flip-id]', { timeout: 20000 })
    await sleep(1000)
    await page.screenshot({ path: path.join(outDir, 'home-back-quick.png'), fullPage: true })

    const quickRequests = requests.slice(requestsBeforeQuick)
    const quickGlobal = quickRequests.filter(r => r.url.includes('/api/news/global') && r.method !== 'OPTIONS')
    log(`Quick round-trip: ${quickGlobal.length} /api/news/global requests (expected 0)`)

    // Stale round-trip: wait 35s in profile
    const requestsBeforeStale = requests.length
    log('SPA navigate to /profile and wait 35s')
    await navigateSPA(page, '/profile')
    await sleep(35000)
    log('SPA navigate back to / after stale wait')
    await navigateSPA(page, '/')
    await page.waitForSelector('[data-news-id], [data-flip-id]', { timeout: 20000 })
    await sleep(2000)
    await page.screenshot({ path: path.join(outDir, 'home-back-stale.png'), fullPage: true })

    const staleRequests = requests.slice(requestsBeforeStale)
    const staleGlobal = staleRequests.filter(r => r.url.includes('/api/news/global') && r.method !== 'OPTIONS')
    log(`Stale round-trip: ${staleGlobal.length} /api/news/global requests (expected 0 with refetchOnMount:false)`)

    // Click a card in a carousel and check URL
    log('Click a news card')
    const cardSelector = '[data-flip-id]:not([data-flip-id=""])'
    await page.waitForSelector(cardSelector, { timeout: 10000 })
    const card = await page.$(cardSelector)
    if (!card) throw new Error('No data-flip-id card found')
    await card.click()
    await sleep(2000)
    const url = page.url()
    log(`After card click URL: ${url}`)
    const hasUndefinedSlug = url.includes('/news/undefined') || url.includes('/news/null')
    log(`Undefined slug check: ${hasUndefinedSlug ? 'FAIL' : 'OK'}`)
    await page.screenshot({ path: path.join(outDir, 'card-click.png'), fullPage: true })

    // Go back home for long SSE/collector test
    log('SPA navigate to / for 6-minute collector test')
    await navigateSPA(page, '/')
    await page.waitForSelector('[data-news-id], [data-flip-id]', { timeout: 20000 })
    const requestsBeforeLong = requests.length
    const sseBeforeLong = consoleMsgs.filter(m => m.text.includes('[SSE]')).length
    log(`SSE console logs before long wait: ${sseBeforeLong}`)

    await sleep(360000) // 6 minutes

    const sseAfterLong = consoleMsgs.filter(m => m.text.includes('[SSE]')).length
    const longRequests = requests.slice(requestsBeforeLong)
    const longNewsRequests = longRequests.filter(r => r.url.includes('/api/news') && !r.url.includes('/stream') && r.method !== 'OPTIONS')
    const longHistoryRequests = longNewsRequests.filter(r => r.url.includes('history=true'))
    const longGlobalRequests = longNewsRequests.filter(r => r.url.includes('/api/news/global'))
    const longUnreadRequests = longNewsRequests.filter(r => r.url.includes('/api/news?') && !r.url.includes('history=true'))
    const longReadRequests = longNewsRequests.filter(r => r.url.includes('/read'))

    log(`Long wait results:`)
    log(`  SSE console logs: ${sseAfterLong - sseBeforeLong}`)
    log(`  /api/news requests (excl stream, excl OPTIONS): ${longNewsRequests.length}`)
    log(`  history=true requests: ${longHistoryRequests.length} (expected 0)`)
    log(`  global requests: ${longGlobalRequests.length}`)
    log(`  unread /news? requests: ${longUnreadRequests.length}`)
    log(`  POST /read requests: ${longReadRequests.length}`)

    await page.screenshot({ path: path.join(outDir, 'home-long.png'), fullPage: true })

    const summary = {
      tokenOk: true,
      immediateGlobalCount: immediateGlobal.length,
      quickGlobalCount: quickGlobal.length,
      staleGlobalCount: staleGlobal.length,
      cardClickUrl: url,
      cardClickUndefined: hasUndefinedSlug,
      long: {
        sseConsoleLogs: sseAfterLong - sseBeforeLong,
        newsRequests: longNewsRequests.length,
        historyRequests: longHistoryRequests.length,
        globalRequests: longGlobalRequests.length,
        unreadRequests: longUnreadRequests.length,
        readRequests: longReadRequests.length,
      },
      consoleErrors: consoleMsgs.filter(m => m.type === 'error').map(m => m.text),
      consoleEncountered: consoleMsgs.filter(m => m.text.includes('Encountered')).map(m => m.text),
      consoleNoRoutes: consoleMsgs.filter(m => m.text.includes('No routes matched')).map(m => m.text),
      sseLogs: consoleMsgs.filter(m => m.text.includes('[SSE]')).map(m => m.text),
    }

    const summaryPath = path.join(outDir, 'debug-summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    log(`Summary saved to ${summaryPath}`)

    fs.writeFileSync(path.join(outDir, 'debug-requests.json'), JSON.stringify(requests, null, 2))
    fs.writeFileSync(path.join(outDir, 'debug-console.json'), JSON.stringify(consoleMsgs, null, 2))

    log('Done')
  } finally {
    await browser.close()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
