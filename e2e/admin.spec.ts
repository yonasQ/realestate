import { expect, test } from '@playwright/test'
import { loginAsAdmin, sql } from './helpers'

const SLUG = 'sumale-tera-three-bedroom-apartment'

test.describe('administration', () => {
  test('admin routes require authentication', async ({ page, request }) => {
    await page.goto('/admin/properties')
    await expect(page).toHaveURL(/\/admin\/login$/)
    const res = await request.get('/admin/inquiries', { maxRedirects: 0 })
    expect([303, 307, 302]).toContain(res.status())
  })

  test('wrong password is rejected with a generic message', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!)
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'incorrect' })).toHaveText('Email or password is incorrect.')
  })

  test('6+7. admin updates a listing and the change appears across the site', async ({ page, context }) => {
    const db = sql()
    const [original] = await db`SELECT id, title, price_mode, price_amount, price_currency, availability FROM properties WHERE slug = ${SLUG}`
    try {
      await loginAsAdmin(page)
      const cookies = await context.cookies()
      const session = cookies.find((c) => c.name.includes('admin_session'))!
      expect(session.httpOnly).toBe(true)
      expect(session.sameSite).toBe('Lax')

      // Warm the public caches so we prove invalidation, not a cold read.
      await page.goto(`/properties/${SLUG}`)
      await page.goto('/properties?area=Piassa')

      await page.goto(`/admin/properties/${original!.id}`)
      await page.getByLabel('Title', { exact: true }).fill('Three-Bedroom Residence, Sumale Tera')
      await page.getByLabel('Price type').selectOption('from')
      await page.getByLabel('Currency', { exact: true }).selectOption('ETB')
      await page.getByLabel('Amount', { exact: true }).fill('9500000')
      await page.getByLabel('Availability').selectOption('limited')
      const save = async () => {
        const done = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/admin/properties/'))
        await page.getByRole('button', { name: 'Save listing' }).click()
        expect((await done).status()).toBe(200)
        await expect(page.getByRole('status').filter({ hasText: 'Listing saved' })).toBeVisible()
      }
      await save()
      // A second save from the same open form must not be flagged as a conflict, and the
      // form must still show the values just saved (no silent revert).
      await expect(page.getByLabel('Availability')).toHaveValue('limited')
      await page.getByLabel('Amount', { exact: true }).fill('9600000')
      await save()

      await page.goto(`/properties/${SLUG}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Three-Bedroom Residence, Sumale Tera')
      await expect(page.getByText('From ETB 9,600,000').first()).toBeVisible()
      await expect(page.getByText('Limited units').first()).toBeVisible()

      await page.goto('/properties?area=Piassa')
      await expect(page.getByRole('heading', { name: 'Three-Bedroom Residence, Sumale Tera' })).toBeVisible()

      await page.goto('/developments/sumale-tera')
      await expect(page.getByText('From ETB 9,600,000')).toBeVisible()
    } finally {
      await db`UPDATE properties SET title = ${original!.title}, price_mode = ${original!.price_mode}, price_amount = ${original!.price_amount}, price_currency = ${original!.price_currency}, availability = ${original!.availability}, version = version + 1 WHERE id = ${original!.id}`
      await db.end()
    }
  })

  test('validation errors are shown and nothing is saved', async ({ page }) => {
    await loginAsAdmin(page)
    const db = sql()
    const [p] = await db`SELECT id, version FROM properties WHERE slug = ${SLUG}`
    await page.goto(`/admin/properties/${p!.id}`)
    await page.getByLabel('Price type').selectOption('fixed')
    await page.getByLabel('Currency', { exact: true }).selectOption('')
    await page.getByLabel('Amount', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save listing' }).click()
    await expect(page.getByText('Enter the price amount')).toBeVisible()
    await expect(page.getByText(/Choose the currency/)).toBeVisible()
    const [after] = await db`SELECT version FROM properties WHERE id = ${p!.id}`
    await db.end()
    expect(after!.version).toBe(p!.version)
  })

  test('new inquiries appear in the admin inbox and can be updated', async ({ page, request }) => {
    const key = crypto.randomUUID()
    const res = await request.post('/api/inquiries', {
      headers: { Origin: test.info().project.use.baseURL! },
      data: { idempotencyKey: key, type: 'general', name: 'Inbox Test', email: 'inbox@example.test', preferredContact: 'email', message: 'Testing the admin inbox flow.', consent: true, elapsedMs: 5000 },
    })
    expect(res.status()).toBe(201)
    const { reference } = await res.json()
    await loginAsAdmin(page)
    await page.goto('/admin/inquiries')
    await page.getByRole('link', { name: 'Inbox Test' }).first().click()
    await expect(page.getByText(reference)).toBeVisible()
    await page.getByLabel('Status', { exact: true }).selectOption('contacted')
    await page.getByLabel('Private notes').fill('Called back, sent brochure.')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Inquiry updated' })).toBeVisible()
  })
})
