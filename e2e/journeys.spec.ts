import { expect, test } from '@playwright/test'
import { futureViewingDate, humanPause, nextSunday, sql } from './helpers'

test.describe('customer journeys', () => {
  test('1. homepage → discover a property → detail page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveTitle(/Addis Ababa/)
    const firstCard = page.locator('#featured-heading').locator('xpath=ancestor::section').getByRole('article').first()
    const title = (await firstCard.getByRole('heading').textContent())!.trim()
    await firstCard.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(/\/properties\/[a-z0-9-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  })

  test('2. filter and search properties with shareable URLs', async ({ page, isMobile }) => {
    await page.goto('/properties')
    const count = page.locator('#results-heading')
    await expect(count).toContainText(/\d+ properties/)
    const total = Number((await count.textContent())!.match(/(\d+)/)![1])

    if (isMobile) await page.getByRole('button', { name: /Filters/ }).click()
    await page.getByLabel('Bedrooms').selectOption('3')
    await expect(page).toHaveURL(/beds=3/)
    await expect(count).not.toContainText(`${total} properties`)
    const cards = page.locator('main article')
    for (const spec of await cards.locator('[aria-label="Key specifications"]').allTextContents()) expect(spec).toContain('3 bed')

    // Shareable: reloading the URL reproduces the same results.
    const filtered = (await count.textContent())!
    await page.reload()
    await expect(count).toHaveText(filtered)

    await page.goto('/properties?q=City%20Plus')
    await expect(cards.first()).toContainText('City Plus')

    await page.goto('/properties?minSize=99999')
    await expect(page.getByRole('heading', { name: 'No properties match these filters' })).toBeVisible()
    await page.getByRole('link', { name: 'Clear all filters' }).click()
    await expect(count).toContainText(`${total} properties`)
  })

  test('3. property detail shows specifications, gallery and location', async ({ page }) => {
    await page.goto('/properties/city-plus-three-bedroom-apartment')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Three-Bedroom Apartment, City Plus/)
    const specs = page.locator('#specs').locator('xpath=..')
    await expect(specs.getByText('Bedrooms')).toBeVisible()
    await expect(specs.getByText('136–151 m²')).toBeVisible()
    await expect(page.getByText('Price on request').first()).toBeVisible()
    // Gallery viewer opens and closes with the keyboard.
    await page.getByRole('button', { name: /images?$/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // Structured data is present and parseable.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(JSON.parse(ld!)[0]['@type']).toBe('RealEstateListing')
  })

  test('4. submit an inquiry for a specific property', async ({ page }) => {
    await page.goto('/properties/blue-point-three-bedroom-apartment')
    const form = page.getByRole('form', { name: 'Inquiry' })
    await form.getByLabel('Full name').fill('E2E Buyer')
    await form.getByRole('textbox', { name: /^Phone/ }).fill('0911 000 111')
    await form.getByLabel(/^Message/).fill('Please share the payment plan.')
    await form.getByRole('checkbox').check()
    await humanPause(page)
    await form.getByRole('button', { name: 'Send inquiry' }).click()
    const status = page.getByRole('status').filter({ hasText: 'Inquiry received' })
    await expect(status).toBeVisible()
    const ref = (await status.locator('strong').textContent())!
    expect(ref).toMatch(/^INQ-/)
    const db = sql()
    const rows = await db`SELECT type, subject_label, phone, consent_at FROM inquiries WHERE reference = ${ref}`
    await db.end()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'property', subject_label: 'Three-Bedroom Apartment, Blue Point', phone: '+251911000111' })
  })

  test('5. request a viewing (with date validation)', async ({ page }) => {
    await page.goto('/contact?type=viewing')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Book a viewing')
    const form = page.getByRole('form', { name: 'Viewing request' })
    await form.getByLabel('What would you like to view?').selectOption('development:city-plus-sarbet')
    await form.getByLabel('Full name').fill('E2E Viewer')
    await form.getByRole('textbox', { name: /^Phone/ }).fill('+251 911 222 333')
    await form.getByRole('checkbox').check()
    await form.getByLabel('Preferred date').fill(nextSunday())
    await humanPause(page)
    await form.getByRole('button', { name: 'Request viewing' }).click()
    await expect(form.getByText('Site viewings are not available on Sundays')).toBeVisible()
    await form.getByLabel('Preferred date').fill(futureViewingDate())
    await form.getByLabel('Time of day').selectOption('morning')
    await form.getByRole('button', { name: 'Request viewing' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Viewing request received' })).toBeVisible()
  })

  test('8a. invalid submissions show accessible field errors and send nothing', async ({ page }) => {
    let posted = false
    page.on('request', (r) => { if (r.url().endsWith('/api/inquiries')) posted = true })
    await page.goto('/contact')
    const form = page.getByRole('form', { name: 'Inquiry' })
    await form.getByRole('button', { name: 'Send inquiry' }).click()
    await expect(form.getByText('Please enter your name')).toBeVisible()
    await expect(form.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByLabel('Full name')).toBeFocused()
    expect(posted).toBe(false)
  })

  test('8b. server/network failures never show a false success and allow safe retry', async ({ page }) => {
    let calls = 0
    const keys: string[] = []
    await page.route('**/api/inquiries', async (route) => {
      calls++
      keys.push(JSON.parse(route.request().postData()!).idempotencyKey)
      if (calls === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'We could not save your request right now.' }) })
      if (calls === 2) return route.abort('timedout')
      return route.continue()
    })
    await page.goto('/contact')
    const form = page.getByRole('form', { name: 'Inquiry' })
    await form.getByLabel('Full name').fill('E2E Retry')
    await form.getByRole('textbox', { name: /^Phone/ }).fill('0911333444')
    await form.getByLabel(/^Message/).fill('Looking for a two-bedroom near Piassa.')
    await form.getByRole('checkbox').check()
    await humanPause(page)
    await form.getByRole('button', { name: 'Send inquiry' }).click()
    await expect(form.getByRole('alert')).toContainText('could not save')
    await expect(page.getByText('Inquiry received')).toBeHidden()
    await form.getByRole('button', { name: 'Try again' }).click()
    await expect(form.getByRole('alert')).toContainText('could not confirm')
    await form.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Inquiry received' })).toBeVisible()
    expect(new Set(keys).size).toBe(1) // every retry reused the same idempotency key
  })
})
