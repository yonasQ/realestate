import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const PAGES = ['/', '/properties', '/properties/city-plus-one-bedroom-apartment', '/developments', '/developments/gelan-commercial-center', '/about', '/contact', '/privacy', '/admin/login']

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const path of PAGES) {
    test(`no serious or critical violations on ${path}`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target}`)).toEqual([])
    })
  }
})

test('every sitemap URL and internal link resolves; no broken images', async ({ page, request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname)
  expect(urls.length).toBeGreaterThan(20)
  const seenLinks = new Set<string>()
  const broken: string[] = []
  for (const path of urls) {
    const res = await page.goto(path)
    if (res?.status() !== 200) broken.push(`${path} → ${res?.status()}`)
    // Force lazy images to load, then verify each decoded.
    await page.evaluate(async () => {
      for (const img of Array.from(document.images)) img.loading = 'eager'
      await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
    })
    const badImages = await page.evaluate(() => Array.from(document.images).filter((i) => !i.naturalWidth).map((i) => i.currentSrc || i.src))
    for (const b of badImages) broken.push(`image ${b} on ${path}`)
    for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))) seenLinks.add(href.split('#')[0]!)
  }
  for (const href of seenLinks) {
    if (href.startsWith('/admin') || urls.includes(href)) continue
    const res = await request.get(href)
    if (res.status() !== 200) broken.push(`link ${href} → ${res.status()}`)
  }
  expect(broken).toEqual([])
})

test('security headers and protections', async ({ request }) => {
  const res = await request.get('/')
  const h = res.headers()
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['x-powered-by']).toBeUndefined()
  // Cross-site form posts are refused.
  const cross = await request.post('/api/inquiries', { headers: { Origin: 'https://attacker.example' }, data: {} })
  expect(cross.status()).toBe(403)
  // Honeypot submissions are rejected.
  const bot = await request.post('/api/inquiries', {
    headers: { Origin: test.info().project.use.baseURL! },
    data: { idempotencyKey: crypto.randomUUID(), type: 'general', name: 'Bot', phone: '0911000000', preferredContact: 'phone', message: 'cheap pills here', consent: true, website: 'http://spam', elapsedMs: 9000 },
  })
  expect(bot.status()).toBe(400)
  // Cron endpoint requires its secret; draft listings are not public; path traversal is refused.
  expect((await request.post('/api/cron/notifications')).status()).toBe(401)
  expect((await request.get('/properties/lycee-seken-one-bedroom-apartment')).status()).toBe(404)
  expect((await request.get('/media/..%2F..%2Fpackage.json')).status()).toBe(404)
  // Admin pages are never indexed or cached.
  const admin = await request.get('/admin/login')
  expect(admin.headers()['x-robots-tag']).toContain('noindex')
})

test('SEO basics: unique titles, descriptions and canonicals', async ({ page }) => {
  const seen = new Map<string, string>()
  for (const path of ['/', '/properties', '/developments', '/about', '/contact', '/properties/city-plus-one-bedroom-apartment', '/developments/city-plus-sarbet']) {
    await page.goto(path)
    const title = await page.title()
    expect(title.length).toBeGreaterThan(10)
    expect(seen.has(title), `duplicate title ${title}`).toBe(false)
    seen.set(title, path)
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy()
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toContain(path === '/' ? '' : path)
    expect(await page.locator('h1').count()).toBe(1)
  }
})
