/**
 * Lab performance measurement against a running production server.
 *   node scripts/measure-performance.mjs [baseUrl]
 * Emulates a mid-range phone on throttled 4G (Lighthouse "Slow 4G": 150ms RTT,
 * 1.6 Mbps down, 4x CPU slowdown), cold cache, and reports TTFB, FCP, LCP, CLS,
 * JS/CSS/image bytes and request count per page.
 */
import { chromium, devices } from '@playwright/test'

const base = process.argv[2] ?? 'http://127.0.0.1:3300'
const pages = ['/', '/properties', '/properties/city-plus-three-bedroom-apartment', '/developments', '/developments/city-plus-sarbet', '/contact']

const browser = await chromium.launch()
const rows = []
for (const path of pages) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const bytes = { script: 0, stylesheet: 0, image: 0, font: 0, document: 0, other: 0 }
  let requests = 0
  cdp.on('Network.loadingFinished', () => requests++)
  const types = new Map()
  cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type.toLowerCase()))
  cdp.on('Network.loadingFinished', (e) => {
    const t = types.get(e.requestId) ?? 'other'
    bytes[t in bytes ? t : 'other'] += e.encodedDataLength
  })
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(1000)
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return { ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp?.startTime ?? 0), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3) }
  })
  rows.push({ path, ...m, jsKB: Math.round(bytes.script / 1024), cssKB: Math.round(bytes.stylesheet / 1024), imgKB: Math.round(bytes.image / 1024), fontKB: Math.round(bytes.font / 1024), htmlKB: Math.round(bytes.document / 1024), requests })
  await ctx.close()
}
await browser.close()
console.table(rows)
