import { test, expect } from '../helpers/offline.js';

const roomTitle = 'Friday Football Match';
const privateNotes = 'Private fixture meeting instructions';
const api = 'http://127.0.0.1:8001/api/v1';

function roomCard(page) {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', { name: roomTitle, exact: true }),
  });
}

async function expectModalPageFocus(page) {
  const active = await page.evaluate(() => ({
    tag: document.activeElement.tagName,
    inside: Boolean(document.activeElement.closest('dialog')),
    // Native dialogs can move Tab focus to browser chrome. activeElement then
    // reports BODY/HTML, while background page controls must remain inert.
    documentFallback: document.activeElement === document.body || document.activeElement === document.documentElement,
  }));
  expect(active.inside || active.documentFallback, JSON.stringify(active)).toBe(true);
}

test('production nested room URLs survive direct navigation and refresh without exposing private details', async ({ page }) => {
  const response = await page.goto('/rooms/1');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: roomTitle, exact: true })).toBeVisible();
  await expect(page.getByText(privateNotes, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in to request a place', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Players', exact: true })).toHaveCount(0);

  const refresh = await page.reload();
  expect(refresh.status()).toBe(200);
  await expect(page).toHaveURL(/\/rooms\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: roomTitle, exact: true })).toBeVisible();
  await expect(page.getByText(privateNotes, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

  await page.goto('/missing/nested/page');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
});

test('public discovery filters real activities and keeps private venue fields out of API and preview', async ({ page, request }) => {
  await page.goto('/sports');
  await expect(page.getByRole('heading', { name: 'Choose your activity', exact: true })).toBeVisible();
  await expect(roomCard(page)).toBeVisible();
  const activity = page.getByRole('combobox', { name: 'Activity', exact: true });
  await expect(activity).toContainText('Basketball');
  await activity.selectOption('2');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/sport_id=2/);
  await expect(roomCard(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(roomCard(page)).toBeVisible();
  await roomCard(page).getByRole('button', { name: 'View activity', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: roomTitle, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Manama · Capital', { exact: true })).toBeVisible();
  await expect(page.getByText(privateNotes, { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Request to join', exact: true })).toHaveCount(0);

  const response = await request.get(`${api}/rooms/1`);
  expect(response.status()).toBe(200);
  const details = await response.json();
  expect(details).toMatchObject({ id: 1, title: roomTitle, area: 'Manama', district: 'capital' });
  expect(details).not.toHaveProperty('venue_notes');
  expect(details).not.toHaveProperty('venue_location');
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('activity dialog supports keyboard entry, modal focus containment and Escape focus restoration', async ({ page }) => {
  await page.goto('/sports');
  const trigger = roomCard(page).getByRole('button', { name: 'View activity', exact: true });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: roomTitle, exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  await expect(close).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Refresh activity', exact: true })).toBeVisible();

  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    await expectModalPageFocus(page);
  }
  const backgroundHome = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true });
  await backgroundHome.evaluate(element => element.focus());
  await expect(backgroundHome).not.toBeFocused();
  await expectModalPageFocus(page);
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expectModalPageFocus(page);
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('phone navigation and activity dialogs remain usable without horizontal overflow', async ({ page }) => {
  const width = 390;
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your people. Get moving.', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  for (const name of ['Home', 'Groups', 'Sports', 'Host a room', 'Cups', 'Sign in', 'Sign up']) {
    const link = navigation.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  }
  await navigation.getByRole('link', { name: 'Sports', exact: true }).click();
  await expect(page).toHaveURL(/\/sports$/);
  await roomCard(page).getByRole('button', { name: 'View activity', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: roomTitle, exact: true });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await navigation.getByRole('link', { name: 'Groups', exact: true }).click();
  await expect(page.getByText('Sign in to see your groups and invitations.', { exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: 'Host a room', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
