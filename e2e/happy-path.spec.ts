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

// Regression: previously, Reset didn't clear the isSampleData flag, so the
// next ICS import triggered a "clear sample data" cleanup that wiped the
// freshly imported CSV tickets. This test exercises Reset → CSV → ICS and
// verifies the CSV tickets survive.
test('Reset → CSV import → ICS import does not wipe the CSV tickets', async ({ page }) => {
  await page.goto('/')

  // Clear the sample data
  await page.getByRole('button', { name: 'Reset' }).click()
  const resetDialog = page.getByRole('dialog', { name: 'Reset Calendar' })
  await resetDialog.getByRole('button', { name: 'Clear Everything' }).click()

  // Import a small CSV — one ticket assigned to "Test User"
  await expandSection(page, 'Tickets')
  await page.getByRole('button', { name: 'Shortcut Epic CSV' }).click()
  const csvDialog = page.getByRole('dialog', { name: 'Import Epic from Shortcut' })
  await expect(csvDialog).toBeVisible()

  const csvContent =
    'id,name,owners,started_at,is_archived\n' +
    'TT-500,CSV survivor ticket,test.user@example.com,,false'
  await csvDialog.locator('input[type="file"]').setInputFiles({
    name: 'epic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvContent),
  })
  // "Create Stories" button is disabled until both CSV and workspace slug are set
  await csvDialog.getByPlaceholder('e.g. clearbanc').fill('e2e-workspace')
  await csvDialog.getByRole('button', { name: 'Create Stories' }).click()

  // CSV ticket should be in the sidebar
  await expandSection(page, 'Tickets')
  await expect(page.locator('.ticket-list')).toContainText('TT-500')

  // Import an ICS with a vacation for an unrelated person — should NOT touch tickets
  await expandSection(page, 'Vacations')
  await page.getByRole('button', { name: 'HiBob Vacation Days' }).click()
  const icsDialog = page.getByRole('dialog', { name: 'Sync HiBob Vacation Days' })
  await expect(icsDialog).toBeVisible()

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'SUMMARY:Vacation Person - Out of Office',
    'DTSTART;VALUE=DATE:20260601',
    'DTEND;VALUE=DATE:20260603',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  await icsDialog.locator('input[type="file"]').setInputFiles({
    name: 'vacations.ics',
    mimeType: 'text/calendar',
    buffer: Buffer.from(icsContent),
  })

  // Picker opens. "Vacation Person" doesn't match the existing roster
  // (just Test User), so the picker starts it unchecked — click to opt in.
  const pickerDialog = page.getByRole('dialog', { name: 'Sync HiBob Vacations' })
  await expect(pickerDialog).toBeVisible()
  await pickerDialog.getByText('Vacation Person').click()
  await pickerDialog.getByRole('button', { name: 'Next' }).click()

  // The calendar already has CSV data, so the import gate opens — pick Merge
  // so the existing TT-500 ticket isn't wiped.
  const importPrompt = page.getByRole('dialog', { name: 'Calendar Has Data' })
  await expect(importPrompt).toBeVisible()
  await importPrompt.getByRole('button', { name: 'Merge' }).click()

  // Vacation Person doesn't exist in the roster → none tier → auto-create
  // silently. No PeopleConfirmModal step.

  // CSV ticket must STILL be there
  await expandSection(page, 'Tickets')
  await expect(page.locator('.ticket-list')).toContainText('TT-500')
})

// Regression: unchecking the last selected month used to leave the calendar
// in a confusing "Select a month from the sidebar" dead-end. Now it's blocked
// with a toast and the checkbox snaps back to checked.
test('cannot uncheck the last selected month', async ({ page }) => {
  await page.goto('/')
  await expandSection(page, 'Months')

  // Sample data selects 4 months by default. Uncheck them until one remains.
  const checked = page.locator('.month-option input[type="checkbox"]:checked')
  while ((await checked.count()) > 1) {
    await checked.first().uncheck()
  }

  // Exactly one left — try to uncheck it
  await expect(checked).toHaveCount(1)
  const lastBox = checked.first()
  await lastBox.click() // click attempts to toggle off

  // Rejection toast appears
  await expect(page.locator('.rejection-toast')).toContainText('At least one month')

  // Checkbox snaps back to checked, count is still 1
  await expect(page.locator('.month-option input[type="checkbox"]:checked')).toHaveCount(1)
})
