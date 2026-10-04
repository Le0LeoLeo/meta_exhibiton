import { randomUUID } from 'node:crypto';
import { test, expect, request as apiRequest } from '@playwright/test';

test('owner filters measured visits and removes a public artwork comment', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const created = await request.post('/api/galleries', { headers, data: {
    title: 'Analytics acceptance gallery', description: 'Isolated browser acceptance', templateTitle: 'Acceptance',
    templateImage: '/demo/harbour.svg', category: 'art',
    sceneJson: JSON.stringify({ roomSize: { width: 10, length: 10, height: 5, wallThickness: 0.1 }, floorPlanElements: [], wallMaterialOverrides: {},
      items: [{ id: 'analytics-artwork', type: 'painting', title: 'Analytics artwork', artist: 'Acceptance', description: 'Synthetic work',
        content: '/demo/harbour.svg', position: [0, 2, -4.85], rotation: [0, 0, 0], scale: [1, 1, 1], frameWidth: 3, frameHeight: 2, frameStyle: 'borderless' }] }),
  } });
  expect(created.ok(), await created.text()).toBe(true);
  const galleryId = (await created.json()).gallery.id;
  try {
    expect((await request.post(`/api/galleries/${galleryId}/publish`, { headers, data: {} })).ok()).toBe(true);
    const anonymous = await apiRequest.newContext({ baseURL: 'http://127.0.0.1:5193' });
    try {
      const visitorId = randomUUID();
      const sessionId = randomUUID();
      const visitUrl = `/api/galleries/${galleryId}/visits`;
      const firstVisit = await anonymous.post(visitUrl, { data: { visitorId, sessionId, mode: '2d', activeSeconds: 0, itemDwellSeconds: {} } });
      expect(firstVisit.ok(), await firstVisit.text()).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 1100));
      const visit = await anonymous.post(visitUrl, { data: { visitorId, sessionId, mode: '2d', activeSeconds: 1, itemDwellSeconds: { 'analytics-artwork': 1 } } });
      expect(visit.ok(), await visit.text()).toBe(true);
      const comment = await anonymous.post(`/api/galleries/${galleryId}/items/analytics-artwork/comments`, { data: { userName: 'Synthetic visitor', content: 'Please explain this artwork.' } });
      expect(comment.ok(), await comment.text()).toBe(true);
    } finally { await anonymous.dispose(); }

    await page.addInitScript(() => localStorage.setItem('metaexpo-locale', 'en'));
    await page.goto('/login');
    await page.locator('#login-email').fill('creator@example.invalid');
    await page.locator('#login-password').fill('SyntheticPassword2026!');
    await page.getByRole('button', { name: 'Log In', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/admin/exhibitions');
    await expect(page.getByRole('heading', { name: 'Exhibition Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('Analytics artwork', { exact: true })).toBeVisible();
    await expect(page.getByText('Please explain this artwork.')).toBeVisible();
    const filtered = page.waitForResponse(response => response.url().includes('/api/galleries/admin/analytics?') && response.url().includes(`galleryId=${galleryId}`));
    await page.getByRole('combobox', { name: 'Gallery' }).selectOption(galleryId);
    const filteredData = await (await filtered).json();
    expect(filteredData.summary.totalVisits).toBe(1);
    expect(filteredData.summary.totalDwellSeconds).toBe(1);
    expect(filteredData.items.find((item: { itemId: string }) => item.itemId === 'analytics-artwork').dwellSeconds).toBe(1);
    const ranged = page.waitForResponse(response => response.url().includes('/api/galleries/admin/analytics?') && response.url().includes('range=7d'));
    await page.getByRole('combobox', { name: 'Date range' }).selectOption('7d');
    expect((await (await ranged).json()).summary.totalVisits).toBe(1);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Please explain this artwork.')).toHaveCount(0);
    const final = await request.get(`/api/galleries/admin/analytics?range=7d&galleryId=${galleryId}`, { headers });
    expect((await final.json()).summary.totalComments).toBe(0);
  } finally {
    const removed = await request.delete(`/api/galleries/${galleryId}`, { headers });
    expect(removed.ok(), await removed.text()).toBe(true);
  }
});
