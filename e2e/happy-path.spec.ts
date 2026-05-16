import { test, expect, type Page } from '@playwright/test'

// Each test gets a fresh browser context from Playwright by default, so localStorage
// starts empty and the app's seedDefaultData() runs on first load.

// All sidebar sections start collapsed. This helper expands the named section
// by clicking its header, then waits for the body content to be visible.
// Section headers use a CSS ::before with content:attr(data-label), which doubles
// the accessible name (e.g. "PeoplePeople"). We match on the start instead of
// requiring an exact name.
async function expandSection(page: Page, name: string) {
  const header = page.locator('.section-header', { hasText: new RegExp(`^${name}$`) }).first()
  await expect(header).toBeVisible()
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
    await expect(header).toHaveAttribute('aria-expanded', 'true')
  }
}

test('app loads with sample data seeded', async ({ page }) => {
  await page.goto('/')

  // Project brief panel shows the seeded team
  const brief = page.getByRole('main')
  await expect(brief.getByText('Alex', { exact: true })).toBeVisible()
  await expect(brief.getByText('Myra', { exact: true })).toBeVisible()

  // A few seeded tickets are placed on the calendar; at least one should be visible
  await expect(page.getByText('PROJ-148').first()).toBeVisible()
})

test('user can add a new person via the modal', async ({ page }) => {
  await page.goto('/')
  await expandSection(page, 'People')

  await page.getByRole('button', { name: 'Add Person' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Person' })).toBeVisible()

  await page.getByPlaceholder('Name').fill('Carol Newman')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await expect(page.locator('.people-list')).toContainText('Carol Newman')
})

test('user can add a new ticket via the modal', async ({ page }) => {
  await page.goto('/')
  await expandSection(page, 'Tickets')

  await page.getByRole('button', { name: 'Add Ticket' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Ticket' })).toBeVisible()

  await page.getByPlaceholder('e.g. PROJ-123').fill('TT-100')
  await page.getByPlaceholder('Ticket title').fill('My new ticket')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await expect(page.locator('.ticket-list').first()).toContainText('TT-100')
})

test('save and reload preserves the project state', async ({ page }) => {
  await page.goto('/')
  await expandSection(page, 'People')

  // Add a uniquely identifiable person so we know we're seeing our save round-trip
  await page.getByRole('button', { name: 'Add Person' }).click()
  await page.getByPlaceholder('Name').fill('Round Trip User')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.people-list')).toContainText('Round Trip User')

  // Save to the browser
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const saveDialog = page.getByRole('dialog', { name: 'Save Project' })
  await expect(saveDialog).toBeVisible()

  await saveDialog.getByPlaceholder('My Project').fill('e2e-roundtrip')
  await saveDialog.getByRole('button', { name: /^(Save|Update)$/ }).click()
  await expect(saveDialog.getByRole('button', { name: /Saved|Updated/ })).toBeVisible()
  await saveDialog.getByRole('button', { name: 'Close' }).click()

  // Reload — sample data is re-seeded for the new "session", so the saved
  // project should NOT auto-load. Open the Load modal and pick it.
  await page.reload()

  await page.getByRole('button', { name: 'Load' }).click()
  const loadDialog = page.getByRole('dialog', { name: 'Load Project' })
  await expect(loadDialog).toBeVisible()
  await expect(loadDialog).toContainText('e2e-roundtrip')

  await loadDialog.getByRole('button', { name: 'Load' }).click()

  // After load, our custom person should be back
  await expandSection(page, 'People')
  await expect(page.locator('.people-list')).toContainText('Round Trip User')
})

test('share link encodes and decodes the project', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')

  const shareButton = page.getByRole('button', { name: /Copy shareable link/ })
  await expect(shareButton).toBeVisible()
  await shareButton.click()

  // Read the URL the app copied to the clipboard
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedUrl).toContain('#share=')

  // Open it in a fresh page — the shared payload should hydrate the brief panel
  const fresh = await context.newPage()
  await fresh.goto(copiedUrl)

  await expect(fresh.getByRole('main').getByText('Alex', { exact: true })).toBeVisible()
})
