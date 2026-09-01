#!/usr/bin/env node
/**
 * Ripple click position test using Playwright.
 */

const { chromium } = require('playwright-core')

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto('https://pulse-frontend-jt53.onrender.com/', { waitUntil: 'networkidle', timeout: 60_000 })
  await page.waitForTimeout(1_500)
  await page.evaluate(() => {
    const el = document.querySelector('section h2')
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
  })
  await page.waitForTimeout(500)
  const card = page.locator('[data-tag-id] .pts-card').first()
  if (await card.count() === 0) {
    console.log('No card found')
    await browser.close()
    return
  }
  await card.click()
  await page.waitForTimeout(100)
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
