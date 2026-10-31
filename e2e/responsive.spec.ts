import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]
const PAGES = ['/', '/properties', '/properties/city-plus-two-bedroom-apartment', '/developments', '/developments/aware-sumeya', '/about', '/contact']

test.describe('responsive layout', () => {
  test.skip(({ isMobile }) => isMobile, 'viewports are set explicitly')
  for (const vp of VIEWPORTS) {
    for (const path of PAGES) {
      test(`${vp.name} ${path}: no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow).toBeLessThanOrEqual(0)
        await page.screenshot({ path: `test-results/screens/${vp.name}${path.replace(/\//g, '_') || '_home'}.png`, fullPage: false })
      })
    }
  }

  test('mobile navigation menu opens, traps nothing and closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Mobile' })
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await page.getByRole('button', { name: 'Open menu' }).click()
    await menu.getByRole('link', { name: 'Developments' }).click()
    await expect(page).toHaveURL(/\/developments$/)
    await expect(menu).toBeHidden()
  })
})
