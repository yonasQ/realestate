import { expect, type Page } from '@playwright/test'
import postgres from 'postgres'

export function sql() {
  return postgres(process.env.E2E_DATABASE_URL!, { max: 1, onnotice: () => {} })
}

/** Next weekday (Mon–Sat) at least `days` ahead, as YYYY-MM-DD. */
export function futureViewingDate(days = 3): string {
  const d = new Date(Date.now() + days * 864e5)
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function nextSunday(): string {
  const d = new Date(Date.now() + 2 * 864e5)
  while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Forms reject submissions made faster than a human could type (bot heuristic). */
export async function humanPause(page: Page) {
  await page.waitForTimeout(2700)
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}
