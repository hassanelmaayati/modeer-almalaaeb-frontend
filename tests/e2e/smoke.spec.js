import { test, expect } from '../helpers/offline.js';

const roomTitle = 'Friday Football Match';
const privateNotes = 'Private fixture meeting instructions';
const api = 'http://127.0.0.1:8001/api/v1';

function roomCard(page) {
  return page.getByRole('article').filter({
    has: page.getByRole('heading', { name: roomTitle, exact: true }),
  });
}

function roomPreviewButton(page) {
  return roomCard(page).getByRole('button', { name: `View game: ${roomTitle}`, exact: true });
}

function themeToggle(page) {
  return page.getByRole('banner').getByRole('button', { name: 'Dark mode', exact: true });
}

async function expectTheme(page, theme) {
  await expect(themeToggle(page)).toHaveAttribute('aria-pressed', String(theme === 'dark'));
  await expect.poll(() => page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(theme === 'dark');
  await expect.poll(() => page.locator('html').evaluate(element => getComputedStyle(element).colorScheme)).toBe(theme);
}

// Browsers can report OKLCH/color-mix colours instead of RGB. Canvas resolves
// those colours into rendered sRGB pixels so the contrast checks work across engines.
async function renderedColours(locator, property = 'color') {
  return locator.evaluate((element, property) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgb = value => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const composite = (front, back) => front.slice(0, 3).map((channel, index) => channel * front[3] / 255 + back[index] * (1 - front[3] / 255));
    let backgrounds = [[255, 255, 255]];
    let textColours;
    const layers = [];
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) layers.unshift(ancestor);
    for (const ancestor of layers) {
      const style = getComputedStyle(ancestor);
      backgrounds = backgrounds.map(background => composite(rgb(style.backgroundColor), background));
      // Check all gradient stops, including chat surfaces and the animated heading text.
      const gradient = style.backgroundImage.match(/^linear-gradient\((.*)\)$/);
      if (gradient) {
        let depth = 0;
        let start = 0;
        const stops = [];
        for (let index = 0; index <= gradient[1].length; index++) {
          const character = gradient[1][index];
          if (character === '(') depth++;
          if (character === ')') depth--;
          if ((character === ',' && depth === 0) || index === gradient[1].length) {
            stops.push(gradient[1].slice(start, index).trim());
            start = index + 1;
          }
        }
        const colours = stops.filter(stop => !/^(?:to\s|[-\d.]+(?:deg|turn|rad|grad)$)/.test(stop))
          .map(stop => rgb(stop.replace(/(?:\s+[\d.]+(?:%|px))+$/, '')));
        if (style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text') textColours = colours;
        else backgrounds = backgrounds.flatMap(background => colours.map(colour => composite(colour, background)));
      }
    }
    const luminance = colour => colour.map(channel => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const foregrounds = (property === 'color' && textColours) || [rgb(getComputedStyle(element)[property])];
    return backgrounds.flatMap(background => foregrounds.map(colour => {
      const foreground = composite(colour, background);
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return {
        foreground, background, backgroundLuminance,
        contrast: (Math.max(foregroundLuminance, backgroundLuminance) + .05) / (Math.min(foregroundLuminance, backgroundLuminance) + .05),
      };
    })).sort((left, right) => left.contrast - right.contrast)[0];
  }, property);
}

async function expectReadable(locator, minimum = 4.5) {
  await expect(locator).toBeVisible();
  await expect.poll(async () => (await renderedColours(locator)).contrast, `Rendered text contrast must reach ${minimum}:1`).toBeGreaterThanOrEqual(minimum);
}

async function expectSurface(locator, theme) {
  await expect(locator).toBeVisible();
  const colours = await renderedColours(locator);
  if (theme === 'dark') expect(colours.backgroundLuminance, JSON.stringify(colours)).toBeLessThan(.15);
  else expect(colours.backgroundLuminance, JSON.stringify(colours)).toBeGreaterThan(.7);
}

async function expectMobileThemeControl(page, width) {
  const toggle = themeToggle(page);
  await expect(toggle).toBeVisible();
  const minimum = await toggle.evaluate(element => {
    const style = getComputedStyle(element);
    return { width: Number.parseFloat(style.minWidth), height: Number.parseFloat(style.minHeight) };
  });
  expect(minimum.width).toBeGreaterThanOrEqual(44);
  expect(minimum.height).toBeGreaterThanOrEqual(44);
  const bounds = await toggle.boundingBox();
  // Firefox's device-pixel conversion can report 43.999992px for a 44px control.
  expect(Math.round(bounds.width * 100) / 100).toBeGreaterThanOrEqual(44);
  expect(Math.round(bounds.height * 100) / 100).toBeGreaterThanOrEqual(44);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
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

test('theme is initialized before the application bundle for device and saved preferences', async ({ offlineContext }) => {
  test.setTimeout(60_000);
  for (const { device, saved, expected } of [
    { device: 'dark', saved: null, expected: 'dark' },
    { device: 'light', saved: 'dark', expected: 'dark' },
    { device: 'dark', saved: 'light', expected: 'light' },
  ]) {
    const context = await offlineContext({ colorScheme: device });
    if (saved) await context.addInitScript(value => {
      if (location.origin === 'http://127.0.0.1:5174') localStorage.setItem('modeer-theme', value);
    }, saved);
    const page = await context.newPage();
    let releaseBundle;
    const bundleGate = new Promise(resolve => { releaseBundle = resolve; });
    await page.route('**/assets/index-*.js', async route => { await bundleGate; await route.fallback(); });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await expect.poll(() => page.locator('html').evaluate(element => ({
        dark: element.classList.contains('dark'), scheme: element.style.colorScheme,
      }))).toEqual({ dark: expected === 'dark', scheme: expected });
      await expect(themeToggle(page)).toHaveCount(0);
    } finally {
      releaseBundle();
    }
    await expectTheme(page, expected);
    await context.close();
  }
});

test('device changes remain automatic until a keyboard toggle persists an explicit preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expectTheme(page, 'dark');
  expect(await page.evaluate(() => localStorage.getItem('modeer-theme'))).toBeNull();
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'light');

  await themeToggle(page).focus();
  await expect(themeToggle(page)).toBeFocused();
  expect(await themeToggle(page).evaluate(element => {
    const style = getComputedStyle(element);
    return (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
  })).toBe(true);
  await expect.poll(async () => (await renderedColours(themeToggle(page), 'outlineColor')).contrast).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Space');
  await expectTheme(page, 'dark');
  expect(await page.evaluate(() => localStorage.getItem('modeer-theme'))).toBe('dark');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Find games', exact: true }).click();
  await expect(page).toHaveURL(/\/sports$/);
  await expectTheme(page, 'dark');
  await page.reload();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'dark');

  await themeToggle(page).focus();
  await page.keyboard.press('Enter');
  await expectTheme(page, 'light');
  expect(await page.evaluate(() => localStorage.getItem('modeer-theme'))).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(page, 'light');
  await page.reload();
  await expectTheme(page, 'light');
});

test('invalid preferences and unavailable storage fall back safely to the device theme', async ({ offlineContext }) => {
  const invalidContext = await offlineContext({ colorScheme: 'dark' });
  await invalidContext.addInitScript(() => {
    if (location.origin === 'http://127.0.0.1:5174') localStorage.setItem('modeer-theme', 'invalid-theme');
  });
  const invalidPage = await invalidContext.newPage();
  await invalidPage.goto('/');
  await expectTheme(invalidPage, 'dark');
  await invalidPage.emulateMedia({ colorScheme: 'light' });
  await expectTheme(invalidPage, 'light');
  await invalidContext.close();

  const context = await offlineContext({ colorScheme: 'light' });
  await context.addInitScript(() => {
    if (location.origin !== 'http://127.0.0.1:5174') return;
    for (const method of ['getItem', 'setItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function(key, ...arguments_) {
        if (key === 'modeer-theme') throw new DOMException('Fixture blocks theme storage', 'SecurityError');
        return original.call(this, key, ...arguments_);
      };
    }
  });
  const page = await context.newPage();
  await page.goto('/');
  await expectTheme(page, 'light');
  await themeToggle(page).click();
  await expectTheme(page, 'dark');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Find games', exact: true }).click();
  await expectTheme(page, 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expectTheme(page, 'dark');
  await page.reload();
  await expectTheme(page, 'light');
});

test('theme preferences synchronize between tabs and resume device defaults when removed', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: 'light' });
  await other.goto('/sports');
  await expectTheme(page, 'light');
  await expectTheme(other, 'light');
  await themeToggle(page).click();
  await expectTheme(page, 'dark');
  await expectTheme(other, 'dark');
  await themeToggle(other).click();
  await expectTheme(other, 'light');
  await expectTheme(page, 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await other.emulateMedia({ colorScheme: 'dark' });
  await expectTheme(other, 'light');
  await page.evaluate(() => localStorage.removeItem('modeer-theme'));
  await expectTheme(other, 'dark');
  await page.reload();
  await expectTheme(page, 'dark');
});

test('both palettes render readable public cards, controls, popovers, dialogs, forms and errors', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/sports');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await themeToggle(page).click();
    await expectTheme(page, theme);
    await expectSurface(page.getByRole('banner'), theme);
    await expectReadable(themeToggle(page), 3);
    await expectReadable(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Find games', exact: true }));
    await expectSurface(roomCard(page), theme);
    await expectReadable(page.getByRole('heading', { name: 'Choose your activity', exact: true }), 3);
    await expectReadable(roomCard(page).getByRole('heading', { name: roomTitle, exact: true }), 3);
    await expectReadable(roomCard(page).getByText('Manama', { exact: true }));
    await expectReadable(roomPreviewButton(page));
    await roomPreviewButton(page).hover();
    await expectReadable(roomPreviewButton(page));
    await expectReadable(page.getByText('Team sports and shared outdoor sessions start with finding your people.', { exact: true }));
    await expectReadable(page.locator('.ui-select[data-field="sport_id"] > .ui-trigger'));
    await expect.poll(async () => (await renderedColours(page.locator('.ui-select[data-field="sport_id"] > .ui-trigger'), 'borderTopColor')).contrast).toBeGreaterThanOrEqual(3);

    await page.getByRole('combobox', { name: 'Activity', exact: true }).focus();
    await page.keyboard.press('Space');
    const options = page.getByRole('listbox', { name: 'sport_id', exact: true });
    await expectSurface(options, theme);
    await expectReadable(options.getByRole('option', { name: 'All activities', exact: true }));
    await expectReadable(options.getByRole('option', { name: 'Basketball', exact: true }));
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);

    await page.getByLabel(/^From/).focus();
    await page.keyboard.press('Space');
    const calendar = page.getByRole('dialog', { name: 'Choose date and time', exact: true });
    await expectSurface(calendar, theme);
    await expectReadable(calendar.getByRole('button', { name: 'Done', exact: true }));
    await expectReadable(calendar.locator('.ui-calendar-head strong'));
    await page.keyboard.press('Escape');
    await expect(calendar).toHaveCount(0);

    await roomPreviewButton(page).click();
    const dialog = page.getByRole('dialog', { name: roomTitle, exact: true });
    await expectSurface(dialog, theme);
    await expectReadable(dialog.getByRole('heading', { name: roomTitle, exact: true }), 3);
    await expectReadable(dialog.getByText('Manama · Capital', { exact: true }));
    await expectReadable(dialog.getByRole('link', { name: 'Sign in to request a place', exact: true }));
    await page.keyboard.press('Escape');

    await page.goto('/sign-in');
    await expectTheme(page, theme);
    await expectReadable(page.getByRole('button', { name: 'Sign in', exact: true }));
    await expectSurface(page.getByLabel('Email', { exact: true }), theme);
    await expectReadable(page.getByLabel('Email', { exact: true }));
    await page.goto('/missing/theme-page');
    await expectTheme(page, theme);
    await expectReadable(page.getByRole('heading', { name: 'Page not found', exact: true }), 3);

    await page.route('**/api/v1/rooms?*', route => route.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ detail: 'Activities temporarily unavailable.' }),
    }));
    await page.goto('/sports');
    const error = page.getByRole('alert').filter({ hasText: 'Activities temporarily unavailable.' });
    await expectReadable(error.getByText('Activities temporarily unavailable.', { exact: true }));
    await page.unroute('**/api/v1/rooms?*');
    await page.reload();
    await expect(roomCard(page)).toBeVisible();
  }
});

test('authenticated chat bubbles and editing controls stay readable in both themes', async ({ page, request }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/');
  // Wait for the homepage data before opening chats through the app navigation.
  await expect(page.getByRole('link', { name: 'Football', exact: true })).toBeVisible();
  await expect(roomCard(page)).toBeVisible();
  const login = await request.post(`${api}/auth/login`, { data: { email: 'accepted@example.test', password: 'TestPass123!' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const incoming = await request.post(`${api}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { group_id: 1, body: 'Incoming theme fixture', client_request_id: '00000000-0000-4000-8000-000000000201' },
  });
  expect(incoming.status()).toBe(201);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /^Messages(?: \d+ unread messages)?$/ }).click();
  await page.waitForURL('/messages');
  await page.getByRole('complementary', { name: 'Chats', exact: true }).getByRole('link', { name: /^Weekend Football\b/ }).click();
  await page.waitForURL('/messages/group/1');
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('Own theme fixture');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const log = page.getByRole('log', { name: 'Messages', exact: true });
  const own = log.locator('.message').filter({ hasText: 'Own theme fixture' });
  const received = log.locator('.message').filter({ hasText: 'Incoming theme fixture' });
  await expect(own.getByRole('button', { name: 'Edit message', exact: true })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await themeToggle(page).click();
    await expectTheme(page, theme);
    await expectSurface(log, theme);
    await expectReadable(own.getByText('Own theme fixture', { exact: true }));
    await expectReadable(own.locator('.message-time'));
    await expectReadable(received.getByText('Incoming theme fixture', { exact: true }));
    await expectReadable(received.locator('.message-time'));
    await own.getByRole('button', { name: 'Edit message', exact: true }).click();
    await expectSurface(page.getByRole('textbox', { name: 'Edit your message', exact: true }), theme);
    await expectReadable(page.getByRole('textbox', { name: 'Edit your message', exact: true }));
    await own.getByRole('button', { name: 'Cancel', exact: true }).click();
    await composer.fill('A readable action');
    await expectReadable(page.getByRole('button', { name: 'Send', exact: true }));
    await composer.fill('x'.repeat(2001));
    await expectReadable(page.getByRole('alert').filter({ hasText: 'Messages can be up to 2000 characters.' }));
    await composer.fill('');
  }
});

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
  await activity.focus();
  await page.keyboard.press('Space');
  await page.getByRole('listbox', { name: 'sport_id', exact: true }).getByRole('option', { name: 'Basketball', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/sport_id=2/);
  await expect(roomCard(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(roomCard(page)).toBeVisible();
  await roomPreviewButton(page).click();
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
  const trigger = roomPreviewButton(page);
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
  const backgroundHome = page.getByRole('link', { name: 'Modeer Almalaaeb home', exact: true });
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

for (const width of [320, 390]) {
test(`phone navigation and activity dialogs remain usable in both themes at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your next game starts here', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  const banner = page.getByRole('banner');
  const guestLinks = [
    banner.getByRole('link', { name: 'Modeer Almalaaeb home', exact: true }),
    ...['Find games', 'Cups', 'Groups'].map(name => navigation.getByRole('link', { name, exact: true })),
    ...['Sign up', 'Sign in'].map(name => banner.getByRole('link', { name, exact: true })),
    page.getByRole('link', { name: 'Sign in to host a room', exact: true }),
  ];
  for (const link of guestLinks) {
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  }
  await expectTheme(page, 'light');
  await expectMobileThemeControl(page, width);
  await themeToggle(page).click();
  await expectTheme(page, 'dark');
  await expectMobileThemeControl(page, width);
  await navigation.getByRole('link', { name: 'Find games', exact: true }).click();
  await expect(page).toHaveURL(/\/sports$/);
  await roomPreviewButton(page).click();
  const dialog = page.getByRole('dialog', { name: roomTitle, exact: true });
  await expect(dialog).toBeVisible();
  await expectSurface(dialog, 'dark');
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await navigation.getByRole('link', { name: 'Groups', exact: true }).click();
  await expect(page.getByText('Sign in to see your groups and invitations.', { exact: true })).toBeVisible();
  await banner.getByRole('link', { name: 'Modeer Almalaaeb home', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in to host a room', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

  await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('TestPass123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/');
  const account = banner.getByRole('button', { name: 'Test Owner', exact: true });
  await expect(account).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expectTheme(page, 'dark');
  await expectMobileThemeControl(page, width);
  await themeToggle(page).click();
  await expectTheme(page, 'light');
  await expectMobileThemeControl(page, width);
  await themeToggle(page).click();
  await expectTheme(page, 'dark');
  for (const name of ['Find games', 'Cups', 'Groups', 'Messages', 'Notifications']) {
    const link = navigation.getByRole('link', { name, exact: true });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  }

  await account.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Account', exact: true });
  await expect(menu).toBeVisible();
  await expectSurface(menu, 'dark');
  await expect(account).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('menuitem')).toHaveText(['My rooms', 'Joined rooms', 'Friends', 'Profile', 'Sign out']);
  const menuBounds = await menu.boundingBox();
  expect(menuBounds.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(width + 1);
  await expect(menu.getByRole('menuitem', { name: 'My rooms', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Joined rooms', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: 'My rooms', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Sign out', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('menuitem', { name: 'My rooms', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await expect(account).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'My rooms', exact: true })).toBeFocused();
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Profile', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByLabel('User name', { exact: true })).toHaveValue('Test Owner');
  await banner.getByRole('link', { name: 'Host a room', exact: true }).click();
  await expect(page).toHaveURL(/\/rooms\/new$/);
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await account.click();
  await menu.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(banner.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expectTheme(page, 'dark');
  await page.reload();
  await expectTheme(page, 'dark');
});
}
