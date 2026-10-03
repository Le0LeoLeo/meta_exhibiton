import { test, expect, request as apiRequest, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

for (const mobile of [false, true]) {
  test(`public 3D renders artwork under the real CSP and survives mode switches (${mobile ? 'touch' : 'desktop'})`, async ({ browser, request }, testInfo) => {
    test.setTimeout(120_000);
    const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
    expect(login.ok()).toBe(true);
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#00ff40' } }).png().toBuffer();
    const created = await request.post('/api/galleries', { headers, data: {
      title: 'WebGL acceptance', description: 'Synthetic CSP rendering check', templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg', category: 'art',
      sceneJson: JSON.stringify({ roomSize: { width: 10, length: 10, height: 5, wallThickness: 0.1 }, floorPlanElements: [], wallMaterialOverrides: {},
        items: [{ id: 'webgl-artwork', type: 'painting', title: '畫作 123', artist: 'Acceptance', description: 'Synthetic artwork',
          content: `data:image/png;base64,${image.toString('base64')}`, position: [0, 2, -4.85], rotation: [0, 0, 0], scale: [1, 1, 1], frameWidth: 3, frameHeight: 2, frameStyle: 'borderless' }] }),
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const id = (await created.json()).gallery.id;
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 800 }, isMobile: mobile, hasTouch: mobile });
    try {
      expect((await request.post(`/api/galleries/${id}/publish`, { headers, data: {} })).ok()).toBe(true);
      await context.addInitScript(() => {
        if (location.origin !== 'http://127.0.0.1:5193') return;
        localStorage.setItem('metaexpo-locale', 'en');
        localStorage.setItem('metaverse-exhibition-storage', JSON.stringify({ version: 7, state: { performanceMode: 'performance' } }));
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', message => {
        // The anonymous session probe intentionally returns 401.
        if (message.type() === 'error' && !message.location().url.endsWith('/api/auth/me')) errors.push(message.text());
      });
      const response = await page.goto(`http://127.0.0.1:5193/exhibitions/${id}`);
      expect(response?.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
      expect(response?.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
      expect(await response!.text()).toContain('<meta property="og:title" content="WebGL acceptance">');
      await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible({ timeout: 45_000 });
      async function greenArtworkPixels() {
        const { data, info } = await sharp(await canvas.screenshot({ timeout: 10_000 })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let count = 0;
        // Tone mapping lifts the red/blue channels; distinguish green from neutral walls.
        for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] > 100 && data[i + 1] > data[i] + 40 && data[i + 1] > data[i + 2] + 40) count++;
        return count;
      }
      // An allocated but black/empty WebGL canvas must fail this assertion.
      await expect.poll(greenArtworkPixels, { timeout: 45_000, intervals: [500, 1000, 2000] }).toBeGreaterThan(100);
      await page.screenshot({ path: testInfo.outputPath('public-3d.png'), fullPage: true, timeout: 10_000 });
      await page.getByRole('button', { name: '2D', exact: false }).first().click();
      await expect(page.getByRole('heading', { name: '畫作 123', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '3D', exact: false }).first().click();
      await expect(canvas).toBeVisible();
      await expect.poll(greenArtworkPixels, { timeout: 30_000 }).toBeGreaterThan(100);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await testInfo.attach('rendering-scope', { body: 'Actual WebGL with software rendering; viewport/touch emulation, not physical-phone FPS.', contentType: 'text/plain' });
    } finally {
      await context.close();
      expect((await request.delete(`/api/galleries/${id}`, { headers })).ok()).toBe(true);
    }
  });
}

test('approved student skills open the linked exhibition room without private sources', async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  const auth = async (context: APIRequestContext, email: string) => {
    const response = await context.post('/api/auth/login', { data: { email, password: 'SyntheticPassword2026!' } });
    expect(response.ok(), `${email}: ${response.status()} ${await response.text()}`).toBe(true);
    return { Authorization: `Bearer ${(await response.json()).token}` };
  };
  const teacher = await auth(request, 'creator@example.invalid');
  const studentRequest = await apiRequest.newContext({ baseURL: 'http://127.0.0.1:5193' });
  const student = await auth(studentRequest, 'collaborator@example.invalid');
  const roomArtwork = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#00ff40' } }).png().toBuffer();
  const createdGallery = await request.post('/api/galleries', { headers: student, data: {
    title: 'Student skill exhibition room', description: 'Synthetic room', templateTitle: 'Room', templateImage: '/demo/harbour.svg', category: 'art',
    sceneJson: JSON.stringify({ roomSize: { width: 10, length: 10, height: 5, wallThickness: 0.1 }, floorPlanElements: [], wallMaterialOverrides: {}, items: [
      { id: 'skill-room-artwork', type: 'painting', title: 'Planning exhibit', artist: 'Acceptance user', description: 'Synthetic planning work',
        content: `data:image/png;base64,${roomArtwork.toString('base64')}`, position: [0, 2, -4.85], rotation: [0, 0, 0], scale: [1, 1, 1], frameWidth: 3, frameHeight: 2, frameStyle: 'borderless' },
    ] }),
  } });
  expect(createdGallery.ok(), await createdGallery.text()).toBe(true);
  const galleryId = (await createdGallery.json()).gallery.id;
  expect((await request.post(`/api/galleries/${galleryId}/publish`, { headers: student, data: {} })).ok()).toBe(true);
  const createdClass = await request.post('/api/graduation/classes', { headers: teacher, data: { title: 'Skill portfolio acceptance', description: 'Synthetic class' } });
  expect(createdClass.ok(), await createdClass.text()).toBe(true);
  const cls = (await createdClass.json()).class;
  expect((await request.post('/api/graduation/join', { headers: student, data: { inviteToken: cls.inviteToken } })).ok()).toBe(true);
  const createdProject = await request.post(`/api/graduation/classes/${cls.id}/projects`, { headers: student, data: {
    title: 'Community project', researchQuestion: 'How can we organise a community event?', concept: 'Shared planning',
    process: 'Student planning and reflection', outcome: 'An event plan', team: '', supervisor: '', galleryId,
  } });
  expect(createdProject.ok(), await createdProject.text()).toBe(true);
  const project = (await createdProject.json()).project;
  await page.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en'));
  await page.goto('/login');
  await page.locator('#login-email').fill('collaborator@example.invalid');
  await page.locator('#login-password').fill('SyntheticPassword2026!');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(`/graduation/classes/${cls.id}`);
  await page.getByRole('button', { name: 'Save and continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2. Add evidence and check it', exact: true })).toBeVisible();
  await page.getByLabel('Skill or experience title').fill('Volunteer planning draft');
  await page.getByLabel('What I did').fill('I prepared a draft schedule.');
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.getByText('Saved. Submit when ready.')).toBeVisible();
  await expect(page.getByText('Volunteer planning draft', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ask AI for evidence-based suggestions' }).click();
  await expect(page.getByText('AI is unavailable. No AI claim was generated.')).toBeVisible();
  const cardResponse = await request.post(`/api/graduation/projects/${project.id}/skills`, { headers: student, data: {
    title: 'Community facilitation', context: 'A school event', role: 'Coordinator', actions: 'I organised the volunteer schedule',
    outcome: 'The event ran as planned', reflection: 'I learned to delegate', summary: 'Coordinated volunteers for a school event.',
    tags: ['planning', 'communication'], visibility: 'public', evidence: [
      { kind: 'text', label: 'Public event record', source: 'School', visibility: 'public', content: 'Student coordinated the schedule.' },
      { kind: 'text', label: 'Private note', source: 'Student', visibility: 'private', content: 'Personal draft.' },
    ],
  } });
  expect(cardResponse.ok(), await cardResponse.text()).toBe(true);
  const card = (await cardResponse.json()).skill;
  const submittedCard = await request.post(`/api/graduation/skills/${card.id}/submit`, { headers: student, data: { expectedRevision: card.revision } });
  expect(submittedCard.ok()).toBe(true);
  const reviewedCard = await request.post(`/api/graduation/skills/${card.id}/review`, { headers: teacher, data: { expectedRevision: (await submittedCard.json()).skill.revision, decision: 'approved' } });
  expect(reviewedCard.ok()).toBe(true);
  const submittedProject = await request.post(`/api/graduation/projects/${project.id}/submit`, { headers: student, data: { expectedRevision: project.revision } });
  expect(submittedProject.ok()).toBe(true);
  const reviewedProject = await request.post(`/api/graduation/projects/${project.id}/review`, { headers: teacher, data: { expectedRevision: (await submittedProject.json()).project.revision, decision: 'approved' } });
  expect(reviewedProject.ok()).toBe(true);
  const published = await request.post(`/api/graduation/classes/${cls.id}/publish`, { headers: teacher, data: {} });
  expect(published.ok(), await published.text()).toBe(true);
  const token = (await published.json()).release.token;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/graduation/public/${token}`);
  await expect(page.getByRole('heading', { name: 'Community facilitation' })).toBeVisible();
  await expect(page.getByText('Public event record')).toBeVisible();
  await expect(page.getByText('Private note')).toHaveCount(0);
  await page.getByRole('link', { name: 'Explore skills in 3D' }).click();
  await expect(page).toHaveURL(new RegExp(`/exhibitions/${galleryId}\\?graduation=`));
  await expect(page.getByText('Student skill exhibition room').first()).toBeVisible();
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
  await expect.poll(async () => {
    const { data, info } = await sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let count = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] > 100 && data[i + 1] > data[i] + 40 && data[i + 1] > data[i + 2] + 40) count++;
    return count;
  }, { timeout: 45_000 }).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Student skills and evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Community facilitation' })).toBeVisible();
  await expect(page.getByText('Public event record')).toBeVisible();
  await expect(page.getByText('Private note')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('student-skills-in-original-room.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('an account publishes a CV without class roles and shows only public evidence in its existing room', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#00ff40' } }).png().toBuffer();
  const galleryResponse = await request.post('/api/galleries', { headers, data: {
    title: 'Owner CV room', description: 'Synthetic room', templateTitle: 'Room', templateImage: '/demo/harbour.svg', category: 'art',
    sceneJson: JSON.stringify({ roomSize: { width: 10, length: 10, height: 5, wallThickness: 0.1 }, floorPlanElements: [], wallMaterialOverrides: {}, items: [
      { id: 'cv-artwork', type: 'painting', title: 'CV exhibit', artist: 'Acceptance user', description: 'Synthetic',
        content: `data:image/png;base64,${image.toString('base64')}`, position: [0, 2, -4.85], rotation: [0, 0, 0], scale: [1, 1, 1], frameWidth: 3, frameHeight: 2, frameStyle: 'borderless' },
    ] }),
  } });
  expect(galleryResponse.ok(), await galleryResponse.text()).toBe(true);
  const galleryId = (await galleryResponse.json()).gallery.id;
  expect((await request.post(`/api/galleries/${galleryId}/publish`, { headers, data: {} })).ok()).toBe(true);
  expect((await request.put('/api/cv/me', { headers, data: { headline: 'Community planning', about: 'Synthetic CV', galleryId } })).ok()).toBe(true);
  const created = await request.post('/api/cv/cards', { headers, data: {
    title: 'Coordination', context: 'Community project', role: 'Coordinator', actions: 'Made a plan', outcome: 'Plan completed',
    reflection: 'Learned to delegate', summary: 'Coordinated a shared plan', tags: ['planning'], visibility: 'public', evidence: [
      { kind: 'text', label: 'Public record', source: 'Archive', visibility: 'public', content: 'A schedule exists', url: '' },
      { kind: 'text', label: 'Private note', source: 'Owner', visibility: 'private', content: 'Keep hidden', url: '' },
    ],
  } });
  expect(created.ok(), await created.text()).toBe(true);
  const published = await request.post('/api/cv/publish', { headers, data: { confirm: true } });
  expect(published.ok(), await published.text()).toBe(true);
  const shareToken = (await published.json()).token;
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en'));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:5193/cv/public/${shareToken}`);
    await expect(page.getByRole('heading', { name: 'Coordination' })).toBeVisible();
    await expect(page.getByText('Public record')).toBeVisible();
    await expect(page.getByText('Private note')).toHaveCount(0);
    await page.getByRole('link', { name: 'Explore in the original 3D room' }).click();
    await expect(page).toHaveURL(new RegExp(`/exhibitions/${galleryId}\\?cv=`));
    await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
    await page.getByRole('button', { name: 'Skills and evidence' }).click();
    await expect(page.getByRole('heading', { name: 'Coordination' })).toBeVisible();
    await expect(page.getByText('Public record')).toBeVisible();
    await expect(page.getByText('Private note')).toHaveCount(0);
    await page.getByRole('button', { name: '2D artworks' }).click();
    await expect(page.getByRole('heading', { name: 'CV exhibit' })).toBeVisible();
  } finally { await context.close(); }
});
