#!/usr/bin/env node
/**
 * Screenshot helper using Playwright.
 *
 * Usage:
 *   node scripts/screenshot.cjs --route / --output screenshots/home-mobile.png --fullPage
 *   node scripts/screenshot.cjs --route / --output screenshots/home-desktop.png --fullPage --desktop
 *   node scripts/screenshot.cjs --route / --output screenshots/element.png --selector "section h2"
 */

const { chromium } = require('playwright-core')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'https://pulse-frontend-jt53.onrender.com'

async function capture({ route = '/', output = 'screenshot.png', viewport = { width: 390, height: 844 }, selector, fullPage = false }) {
  const outPath = path.resolve(output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
  })

  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.deviceScaleFactor || 1 })
    const page = await context.newPage()
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(2_000) // let animations/recharts settle

    if (selector) {
      const el = page.locator(selector).first()
      await el.waitFor({ state: 'visible', timeout: 10_000 })
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
