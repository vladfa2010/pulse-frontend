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
  const card = await page.$('[data-tag-id]')
  if (card) {
    await card.click()
    await new Promise(r => setTimeout(r, 350))
    await page.screenshot({ path: 'screenshots/ripple-click.png' })
    console.log('Screenshot saved')
  } else {
    console.log('No card found')
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
