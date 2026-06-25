const puppeteer = require('puppeteer-core')
const fs = require('fs')
const path = require('path')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

async function capture({ route = '/', output = 'screenshot.png', viewport = { width: 390, height: 844 }, selector, fullPage = false }) {
  const outPath = path.resolve(output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport(viewport)
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000)) // let animations/recharts settle

    if (selector) {
      await page.waitForSelector(selector, { timeout: 10000 })
      const el = await page.$(selector)
      if (!el) throw new Error(`Selector not found: ${selector}`)
      await el.screenshot({ path: outPath })
    } else {
      await page.screenshot({ path: outPath, fullPage })
    }

    console.log(`Screenshot saved: ${outPath}`)
  } finally {
    await browser.close()
  }
}

const args = process.argv.slice(2)
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : fallback
}

capture({
  route: getArg('--route', '/'),
  output: getArg('--output', 'screenshots/screenshot.png'),
  selector: getArg('--selector', undefined),
  fullPage: args.includes('--fullPage'),
  viewport: args.includes('--desktop')
    ? { width: 1440, height: 900, deviceScaleFactor: 1 }
    : { width: 390, height: 844, deviceScaleFactor: 2 },
}).catch(err => {
  console.error(err)
  process.exit(1)
})
