const puppeteer = require('puppeteer-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

;(async () => {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  await page.goto('https://pulse-frontend-jt53.onrender.com/', { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1500))
  await page.evaluate(() => {
    const el = document.querySelector('section h2')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await new Promise(r => setTimeout(r, 500))
  const card = await page.$('[data-tag-id] .pts-card')
  if (!card) {
    console.log('No card found')
    await browser.close()
    return
  }
  await card.click()
  await new Promise(r => setTimeout(r, 100))
  const info = await page.evaluate(() => {
    const card = document.querySelector('[data-tag-id] .pts-card')
    const dotWrap = card?.querySelector('.pts-dot-wrap')
    const ripple = card?.lastElementChild
    if (!card || !dotWrap || !ripple) return null
    const cardRect = card.getBoundingClientRect()
    const dotRect = dotWrap.getBoundingClientRect()
    const ripRect = ripple.getBoundingClientRect()
    return {
      dotWrapOffsetLeft: dotWrap.offsetLeft,
      dotWrapOffsetWidth: dotWrap.offsetWidth,
      rippleStyleLeft: ripple.style.left,
      rippleStyleTop: ripple.style.top,
      rippleOffsetLeft: ripple.offsetLeft,
      rippleOffsetTop: ripple.offsetTop,
      dotCenterX: dotRect.left + dotRect.width / 2 - cardRect.left,
      dotCenterY: dotRect.top + dotRect.height / 2 - cardRect.top,
      rippleRectCenterX: ripRect.left + ripRect.width / 2 - cardRect.left,
      rippleRectCenterY: ripRect.top + ripRect.height / 2 - cardRect.top,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await page.screenshot({ path: 'screenshots/ripple-click.png' })
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
