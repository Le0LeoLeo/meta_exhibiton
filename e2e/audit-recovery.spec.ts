import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import type { ExhibitionSceneRequest } from '../src/app/api/exhibitionScene';

const syntheticEmail = 'creator@example.invalid';
const sessionErrorTitle = 'Unable to check your sign-in status';
const outageMessage = 'Synthetic bootstrap outage: internal details';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en'));
});

async function establishCookieSession(page: Page) {
  // The acceptance runner seeds this account in a fresh, isolated database.
  // page.request shares cookies with the browser, without populating app state.
  const response = await page.request.post('/api/auth/login', {
    data: { email: syntheticEmail, password: 'SyntheticPassword2026!' },
  });
  expect(response.ok()).toBe(true);
  expect((await page.context().cookies()).some(cookie => cookie.name === 'mrei_session' && cookie.httpOnly)).toBe(true);
  const { token } = await response.json();
  expect(token).toBeTruthy();
  return String(token);
}

async function interruptSessionBootstrap(page: Page) {
  let interrupted = true;
  await page.route('**/api/auth/me', route => interrupted
    ? route.fulfill({ status: 503, json: { error: outageMessage } })
    : route.continue());
  return () => { interrupted = false; };
}

test('cookie sign-in recovers from a bootstrap outage without losing the requested URL', async ({ page }, testInfo) => {
  await establishCookieSession(page);
  const resumeSessionChecks = await interruptSessionBootstrap(page);
  const requestedPath = '/profile?source=auth-recovery&template=art#details';

  await page.goto(requestedPath);
  const requestedUrl = page.url();
  await expect(page.getByRole('alert')).toContainText(sessionErrorTitle);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toHaveCount(0);
  await expect(page.getByText(outageMessage, { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash).toBe(requestedPath);
  await page.screenshot({ path: testInfo.outputPath('auth-bootstrap-outage.png') });

  resumeSessionChecks();
  const recoveredResponse = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/auth/me'
    && !response.request().headers().authorization,
  );
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  // This response comes from the real server using the previously issued cookie.
  expect((await recoveredResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText(syntheticEmail, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: sessionErrorTitle })).toHaveCount(0);
  await expect(page).toHaveURL(requestedUrl);
  await page.screenshot({ path: testInfo.outputPath('auth-bootstrap-recovered.png') });
});

test('an expired cookie after bootstrap failure redirects to login with the complete return destination', async ({ page }, testInfo) => {
  await establishCookieSession(page);
  const resumeSessionChecks = await interruptSessionBootstrap(page);
  const requestedPath = '/virtual-gallery/my-exhibitions?source=auth-recovery&filter=drafts#saved';
  await page.goto(requestedPath);
  await expect(page.getByRole('heading', { name: sessionErrorTitle })).toBeVisible();

  // Expire only this test browser's cookies; the retry must use the real 401 path.
  await page.context().clearCookies();
  resumeSessionChecks();
  const expiredResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/me');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  expect((await expiredResponse).status()).toBe(401);
  await expect(page.locator('#login-email')).toBeVisible();
  const destination = new URL(page.url());
  expect(destination.pathname).toBe('/login');
  expect(destination.searchParams.get('returnTo')).toBe(requestedPath);
  await expect(page.getByRole('heading', { name: sessionErrorTitle })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('auth-expired-return-destination.png') });
});

test('demo and shared editor use the fullscreen shell while normal navigation is restored on return', async ({ page }, testInfo) => {
  await page.goto('/exhibitions');
  await expect(page.getByRole('heading', { name: 'Exhibitions', exact: true })).toBeVisible();
  await expect(page.locator('.home-navigation')).toBeVisible();
  await expect(page.locator('.home-footer')).toBeVisible();

  // Follow an actual app link so the same Layout instance changes route mode.
  await page.locator('.home-footer a[href="/demo"]').click();
  await expect(page.getByRole('link', { name: 'Back to home', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A small gallery of masterpieces', exact: true })).toBeVisible();
  await expect(page.locator('.home-navigation')).toHaveCount(0);
  await expect(page.locator('.home-footer')).toHaveCount(0);
  await expect(page.locator('.museum-immersive')).toBeVisible();
  await page.getByRole('button', { name: '2D artworks', exact: true }).click();
  await expect.poll(() => page.locator('.museum-immersive img').first().evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('demo-fullscreen.png') });

  await page.getByRole('link', { name: 'Back to home', exact: true }).click();
  await expect(page.locator('.home-navigation')).toBeVisible();
  await page.locator('.home-navigation').getByRole('link', { name: 'Exhibitions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Exhibitions', exact: true })).toBeVisible();
  await expect(page.locator('.home-footer')).toBeVisible();

  // An invalid synthetic token exercises the real shared-route error shell.
  await page.goto('/virtual-gallery/share/audit-recovery-missing-token');
  await expect(page.getByText('Error loading exhibition', { exact: true })).toBeVisible();
  await expect(page.locator('.home-navigation')).toHaveCount(0);
  await expect(page.locator('.home-footer')).toHaveCount(0);
  await expect(page.locator('.museum-immersive')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('shared-editor-error-fullscreen.png') });

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Exhibitions', exact: true })).toBeVisible();
  await expect(page.locator('.home-navigation')).toBeVisible();
  await expect(page.locator('.home-footer')).toBeVisible();
});

test('the integrated creation wizard displays English steps and validation', async ({ page }, testInfo) => {
  await establishCookieSession(page);
  await page.goto('/virtual-gallery/create');
  const wizard = page.locator('[data-slot="exhibition-wizard"]');
  const wizardDialog = page.getByRole('dialog', { name: 'Create a 3D exhibition', exact: true });
  await expect(wizardDialog).toBeVisible();
  await expect(wizard.getByRole('heading', { name: 'Set the exhibition theme', exact: true })).toBeVisible();
  await expect.poll(() => wizardDialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await expect(page.locator('.home-navigation')).toHaveCount(0);
  await expect(page.locator('.home-footer')).toHaveCount(0);

  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(wizard.getByRole('alert')).toHaveText('Enter an exhibition theme first.');
  await wizard.getByLabel('Exhibition theme', { exact: true }).fill('Synthetic local acceptance exhibition');
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(wizard.getByRole('heading', { name: 'Upload student artwork', exact: true })).toBeVisible();
  await expect(wizard.getByLabel('Upload artworks', { exact: true })).toBeAttached();
  await expect(wizard.getByLabel('CSV file', { exact: true })).toBeVisible();
  await expect(wizard.getByText('Import student artwork details', { exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(wizard.getByRole('alert')).toHaveText('Finish uploading at least one artwork first.');
  await page.screenshot({ path: testInfo.outputPath('wizard-english-upload-validation.png') });
});

test('the creation wizard survives gallery creation and returns from preview to publish', async ({ page, browser }, testInfo) => {
  const token = await establishCookieSession(page);
  let createRequests = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/galleries') createRequests += 1;
  });

  let releaseLayout!: () => void;
  const layoutGate = new Promise<void>(resolve => { releaseLayout = resolve; });
  let captureLayout!: (request: ExhibitionSceneRequest) => void;
  const layoutRequested = new Promise<ExhibitionSceneRequest>(resolve => { captureLayout = resolve; });
  // Keep auth, upload, media binding, gallery persistence and publishing real.
  // Only the AI response is deterministic; this does not test provider quality.
  await page.route('**/api/ai/exhibition-scene', async route => {
    const payload = route.request().postDataJSON() as ExhibitionSceneRequest;
    captureLayout(payload);
    await layoutGate;
    await route.fulfill({ json: {
      exhibition: { title: 'Wizard acceptance', curatorialStatement: '', sections: [] },
      warnings: ['Synthetic fallback layout: check artwork spacing before publishing.'], source: 'fallback',
      scene: { ...payload.currentScene, items: [{
        id: 'wizard-acceptance-artwork', type: 'painting', title: 'Wizard artwork',
        content: payload.assets?.[0]?.imageUrl,
        position: [0, 2, -4.85], rotation: [0, 0, 0], scale: [1, 1, 1],
        frameWidth: 2, frameHeight: 2, frameStyle: 'borderless',
      }] },
    } });
  });

  await page.goto('/virtual-gallery/create');
  const wizard = page.locator('[data-slot="exhibition-wizard"]');
  await wizard.getByLabel('Exhibition theme', { exact: true }).fill('Wizard acceptance');
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  const artwork = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#49766e' } }).png().toBuffer();
  await wizard.getByLabel('Upload artworks', { exact: true }).setInputFiles({ name: 'Wizard artwork.png', mimeType: 'image/png', buffer: artwork });
  await expect(wizard.getByText('Uploaded', { exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await wizard.getByLabel('Exhibition style', { exact: true }).fill('Bright, modern, suited to student artwork');
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  try {
    await wizard.getByRole('button', { name: 'Start AI layout', exact: true }).click();
    const payload = await layoutRequested;
    expect(payload.prompt).toBe('Wizard acceptance\n\nExhibition style: Bright, modern, suited to student artwork');
    expect(payload.style).toBe('white-box');
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets?.[0]?.imageUrl).toContain('/api/media/');
    await expect(wizard.getByRole('button', { name: 'Arranging with AI…', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch to the advanced editor', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(wizard).toBeVisible();
    await expect(page).toHaveURL(/exhibitionId=/);
  } finally {
    releaseLayout();
  }

  const galleryId = new URL(page.url()).searchParams.get('exhibitionId');
  expect(galleryId).toBeTruthy();
  await expect(wizard.getByRole('button', { name: 'Use the current scene', exact: true })).toBeVisible();
  await expect(wizard.getByText(/AI layout was unavailable/)).toBeVisible();
  await expect(wizard.getByText('Synthetic fallback layout: check artwork spacing before publishing.', { exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(wizard.getByRole('alert')).toHaveText('Complete the AI layout first.');
  await expect(wizard.getByRole('heading', { name: 'Arrange the exhibition with AI', exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Use the current scene', exact: true }).click();
  await expect(wizard.getByText(/You chose to continue with the current scene/)).toBeVisible();
  await expect(wizard.getByRole('button', { name: 'Run AI layout again', exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await wizard.getByRole('button', { name: 'Open 3D preview', exact: true }).click();
  await expect(wizard).toHaveCount(0);
  const returnToWizard = page.getByRole('button', { name: 'Return to exhibition wizard', exact: true });
  await expect(returnToWizard).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await returnToWizard.click();
  await expect(wizard.getByRole('heading', { name: 'Preview the exhibition', exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(wizard.getByRole('heading', { name: 'Publish the exhibition', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('wizard-ready-to-publish.png') });
  try {
    await wizard.getByRole('button', { name: 'Publish exhibition', exact: true }).click();
    await expect(page).toHaveURL(`/exhibitions/${galleryId}`);
    expect(createRequests).toBe(1);

    const anonymous = await browser.newContext();
    try {
      const published = await anonymous.request.get(`http://127.0.0.1:5193/api/galleries/published/${galleryId}`);
      expect(published.status()).toBe(200);
      const scene = JSON.parse((await published.json()).gallery.sceneJson);
      expect(scene.items).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Wizard artwork' })]));
      const publishedArtwork = scene.items.find((item: { id: string }) => item.id === 'wizard-acceptance-artwork');
      expect(publishedArtwork.content).toMatch(/^\/api\/media\//);
      expect(publishedArtwork.content).not.toContain('accessToken=');
      const visitor = await anonymous.newPage();
      await visitor.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en'));
      await visitor.goto(`http://127.0.0.1:5193/exhibitions/${galleryId}`);
      await visitor.getByRole('button', { name: '2D artworks', exact: true }).click();
      await expect(visitor.getByRole('heading', { name: 'Wizard artwork', exact: true })).toBeVisible();
      const image = visitor.locator('article img').first();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      await visitor.screenshot({ path: testInfo.outputPath('wizard-published-artwork.png') });
    } finally {
      await anonymous.close();
    }
  } finally {
    // Keep the shared synthetic catalogue unchanged for subsequent acceptance cases.
    const cleanup = await page.request.delete(`/api/galleries/${galleryId}/publish`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cleanup.ok()).toBe(true);
  }
});
