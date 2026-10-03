import { test, expect, devices, type Page } from '@playwright/test';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const phone = { userAgent: devices['Pixel 7'].userAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en')); });
async function login(page: Page, email = 'creator@example.invalid', password = 'SyntheticPassword2026!') {
  await page.goto('/login'); await page.locator('#login-email').fill(email); await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('password recovery uses TLS mail, consumes once, revokes old sessions and signs in with the new password', async ({ page, request }) => {
  const old = await request.post('/api/auth/login', { data: { email: 'reset@example.invalid', password: 'SyntheticPassword2026!' } });
  const oldToken = (await old.json()).token; expect(oldToken).toBeTruthy();
  await page.goto('/login'); await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset password', exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('reset@example.invalid');
  await page.getByRole('button', { name: 'Request reset link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  let link = '';
  await expect.poll(async () => {
    const mail = await (await request.get('/__test/mail')).json();
    link = mail.find((x: { to: string[]; text: string }) => x.to.includes('reset@example.invalid') && x.text.includes('/reset-password'))?.text.match(/https:\/\/metaexb.com\/reset-password#token=[A-Za-z0-9_-]{43}/)?.[0] || '';
    return Boolean(link);
  }).toBe(true);
  const localLink = link.replace('https://metaexb.com', '');
  await page.goto(localLink);
  await page.getByLabel('New password', { exact: true }).fill('RecoveredPassword2026!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('RecoveredPassword2026!');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been reset');
  expect((await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(401);
  await login(page, 'reset@example.invalid', 'RecoveredPassword2026!');
  await page.goto(localLink); await page.getByLabel('New password', { exact: true }).fill('RecoveredPassword2026!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('RecoveredPassword2026!');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid, expired or already used');
});

for (const mobile of [false, true]) test.describe(mobile ? 'Touch phone' : 'Desktop', () => {
test.use(mobile ? phone : {});
test(`create, upload, save, reopen, publish, anonymous view, stale save and withdrawal (${mobile ? 'mobile slow network' : 'desktop'})`, async ({ page, browser, request }, testInfo) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/virtual-gallery/quick-create');
  await expect(page.getByRole('listitem').filter({ hasText: '1. Upload an image' })).toHaveAttribute('aria-current', 'step');
  await page.getByLabel('Exhibition title (optional)').fill('Acceptance exhibition');
  const image = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#927644' } }).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'Acceptance artwork.png', mimeType: 'image/png', buffer: image });
  await page.getByRole('radio', { name: 'Bright white gallery' }).check();
  await page.getByRole('button', { name: 'Save and generate preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish exhibition', exact: true })).toBeEnabled({ timeout: 45_000 });
  const draftUrl = page.url(); await page.reload();
  await expect(page.getByRole('button', { name: 'Publish exhibition', exact: true })).toBeEnabled({ timeout: 30_000 });
  expect(page.url()).toBe(draftUrl);
  await page.getByRole('button', { name: 'Publish exhibition', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Exhibition published' })).toBeVisible();
  if (mobile) {
    await expect(page.getByRole('listitem').filter({ hasText: '3. Preview and publish' })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('link', { name: 'Advanced editing', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('mobile-published.png'), fullPage: true });
  }
  const publicLink = page.locator('a[href^="/exhibitions/"]').first();
  const publicPath = await publicLink.getAttribute('href'); expect(publicPath).toBeTruthy();
  await expect(page.getByLabel('Public exhibition link', { exact: true })).toHaveValue(new URL(publicPath!, page.url()).href);
  const id = publicPath!.split('/').at(-1);
  const anonymous = await browser.newContext(mobile ? phone : {});
  try {
    const visitor = await anonymous.newPage();
    if (mobile) {
      const network = await anonymous.newCDPSession(visitor);
      await network.send('Network.enable');
      await network.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 50_000, connectionType: 'cellular4g' });
    }
    const startedAt = Date.now();
    await visitor.goto('http://127.0.0.1:5193' + publicPath);
    await visitor.getByRole('button', { name: '2D artworks', exact: true }).click();
    await expect(visitor.getByRole('heading', { name: 'Acceptance exhibition', exact: true })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: 'Acceptance artwork', exact: true })).toBeVisible();
    const asset = visitor.locator('article img').first();
    await expect(asset).toBeVisible(); await expect.poll(() => asset.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    if (mobile) {
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await visitor.screenshot({ path: testInfo.outputPath('mobile-2d-view.png'), fullPage: true });
      const baselinePath = testInfo.outputPath('mobile-network-baseline.json');
      await writeFile(baselinePath, JSON.stringify({ viewport: '390x844', latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 50000, imageVisibleAndScreenshotMs: Date.now() - startedAt, renderer: '2D fallback; emulated Chromium; no physical-device FPS measurement' }, null, 2));
      await testInfo.attach('mobile-network-baseline.json', { contentType: 'application/json', path: baselinePath });
    }
    const auth = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
    const token = (await auth.json()).token; const headers = { Authorization: `Bearer ${token}` };
    const saved = (await (await request.get(`/api/galleries/${id}`, { headers })).json()).gallery;
    const patch = { expectedRevision: saved.revision, title: 'Acceptance revised' };
    expect((await request.patch(`/api/galleries/${id}`, { headers, data: patch })).ok()).toBe(true);
    expect((await request.patch(`/api/galleries/${id}`, { headers, data: patch })).status()).toBe(409);
    expect((await request.delete(`/api/galleries/${id}/publish`, { headers })).ok()).toBe(true);
    expect((await anonymous.request.get('http://127.0.0.1:5193/api/galleries/published/' + id)).status()).toBe(404);
    await visitor.reload(); await expect(visitor.getByRole('button', { name: '2D artworks' })).toHaveCount(0);
  } finally { await anonymous.close(); }
});
});

test('an unavailable built route chunk offers recovery and succeeds after explicit reload', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible();
  await page.route('**/assets/ResetPassword-*.js', route => route.abort('failed'));
  await page.getByRole('link', { name: 'Forgot Password?' }).click();
  await expect(page.getByRole('heading', { name: 'The page could not finish loading', level: 1 })).toBeVisible();
  await page.unroute('**/assets/ResetPassword-*.js');
  await page.getByRole('main').getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
});

test('mobile public catalogue loads bounded summaries and recovers a failed next page', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const auth = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  const headers = { Authorization: `Bearer ${(await auth.json()).token}` };
  const ids: string[] = [];
  try {
    for (let index = 0; index < 13; index++) {
      const created = await request.post('/api/galleries', { headers, data: {
        title: `Catalogue ${index}`, description: 'Synthetic pagination acceptance', templateTitle: 'Acceptance',
        templateImage: '/demo/harbour.svg', category: 'art',
      } });
      expect(created.ok()).toBe(true);
      const id = (await created.json()).gallery.id; ids.push(id);
      expect((await request.post(`/api/galleries/${id}/publish`, { headers, data: {} })).ok()).toBe(true);
    }
    const response = await request.get('/api/galleries/published');
    const first = await response.json();
    expect(first.galleries).toHaveLength(12); expect(first.nextCursor).toBeTruthy();
    for (const summary of first.galleries) expect(summary).not.toHaveProperty('sceneJson');
    await page.goto('/exhibitions');
    await expect(page.locator('.museum-exhibition-card')).toHaveCount(12);
    let failed = false;
    await page.route('**/api/galleries/published?*', route => {
      if (!failed && new URL(route.request().url()).searchParams.has('after')) { failed = true; return route.abort('failed'); }
      return route.continue();
    });
    await page.getByRole('button', { name: 'Load more exhibitions' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.museum-exhibition-card')).toHaveCount(12);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.locator('.museum-exhibition-card')).toHaveCount(13);
    await expect(page.getByRole('button', { name: 'Load more exhibitions' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    for (const id of ids) expect((await request.delete(`/api/galleries/${id}`, { headers })).ok()).toBe(true);
  }
});
