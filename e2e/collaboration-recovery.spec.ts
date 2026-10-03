import { test, expect, type BrowserContext, type Page, type WebSocketRoute } from '@playwright/test';

test.use({ viewport: { width: 1100, height: 800 }, trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

async function socketGate(context: BrowserContext) {
  const connections: Array<{ page: WebSocketRoute; server: WebSocketRoute }> = [];
  const gate = { offline: false, joined: 0, writes: 0, cut: async () => {
    gate.offline = true; await context.setOffline(true);
    for (const pair of connections.splice(0)) { await pair.page.close({ code: 1001 }); await pair.server.close({ code: 1001 }); }
  }, resume: async () => { gate.offline = false; await context.setOffline(false); } };
  await context.routeWebSocket('**/socket.io/**', socket => {
    if (gate.offline) { void socket.close({ code: 1001 }); return; }
    const server = socket.connectToServer(); connections.push({ page: socket, server });
    server.onMessage(message => { if (message.toString().includes('"room:joined"')) gate.joined++; socket.send(message); });
    socket.onMessage(message => { if (/"scene:(op|sync)"/.test(message.toString())) gate.writes++; server.send(message); });
  });
  return gate;
}

async function openEditor(page: Page, path: string, email: string) {
  const auth = await page.request.post('/api/auth/login', { data: { email, password: 'SyntheticPassword2026!' } });
  expect(auth.ok()).toBe(true);
  await page.bringToFront();
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Save Exhibition', exact: true })).toBeVisible({ timeout: 45_000 });
  await page.getByText('Space & Materials', { exact: true }).click();
  await expect(page.locator('canvas').first()).toBeVisible();
  expect(await page.locator('canvas').evaluateAll(canvases => canvases.some(element => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl && !gl.isContextLost() && gl.drawingBufferWidth > 0);
  }))).toBe(true);
}

test('two real 3D editors preserve interrupted edits, merge remote work and recover after reload', async ({ browser, request }, testInfo) => {
  test.setTimeout(180_000);
  const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const created = await request.post('/api/galleries', { headers, data: {
    title: 'Synthetic 3D recovery', description: 'Isolated browser acceptance', templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg', category: 'art',
    sceneJson: JSON.stringify({ roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 }, items: [], floorPlanElements: [], wallMaterialOverrides: {} }),
  } });
  expect(created.ok(), await created.text()).toBe(true);
  const id = (await created.json()).gallery.id;
  const share = await request.post(`/api/galleries/${id}/share-link`, { headers, data: { role: 'editor' } });
  expect(share.ok()).toBe(true);
  const path = `/virtual-gallery/share/${(await share.json()).share.token}`;
  const aContext = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const bContext = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  try {
    for (const context of [aContext, bContext]) await context.addInitScript(() => {
      localStorage.setItem('metaexpo-locale', 'en');
      // Existing user preference, selected before GPU startup for software-rendered acceptance.
      if (!localStorage.getItem('metaverse-exhibition-storage')) localStorage.setItem('metaverse-exhibition-storage', JSON.stringify({ version: 7, state: { performanceMode: 'performance' } }));
    });
    const gateA = await socketGate(aContext); const gateB = await socketGate(bContext);
    const a = await aContext.newPage(); const b = await bContext.newPage();
    await openEditor(a, path, 'creator@example.invalid'); console.log('PASS first live WebGL editor');
    await openEditor(b, path, 'collaborator@example.invalid'); console.log('PASS second live WebGL editor');
    await expect.poll(() => gateA.joined).toBeGreaterThan(0); await expect.poll(() => gateB.joined).toBeGreaterThan(0);
    const widthA = a.getByRole('slider', { name: 'Room Width' });
    const lengthB = b.getByRole('slider', { name: 'Room Length' });
    const joinsBeforeInterruption = gateA.joined;
    await gateA.cut();
    console.log('PASS first connection interrupted');
    await a.bringToFront();
    await expect(a.getByRole('alert').filter({ hasText: 'Connection interrupted' })).toBeVisible();
    await widthA.focus(); await widthA.press('ArrowRight');
    await b.bringToFront();
    await lengthB.focus(); await lengthB.press('ArrowRight');
    console.log('PASS local and remote room edits');
    await expect.poll(async () => JSON.parse((await (await request.get(`/api/galleries/${id}`, { headers })).json()).gallery.sceneJson).roomSize.length).toBe(21);
    await gateA.resume();
    await a.bringToFront();
    console.log('PASS connection resumed');
    // A WebSocket attempt started while offline may first hit Socket.IO's 20s connect timeout.
    await expect.poll(() => gateA.joined, { timeout: 45_000 }).toBeGreaterThan(joinsBeforeInterruption);
    await expect(a.getByRole('button', { name: 'Merge my changes', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(widthA).toHaveValue('21');
    const writesBefore = gateA.writes;
    await a.screenshot({ path: testInfo.outputPath('3d-reconnected-review.png') });
    expect(gateA.writes).toBe(writesBefore);
    await a.getByRole('button', { name: 'Merge my changes', exact: true }).click();
    console.log('PASS explicit merge selected');
    await expect(a.getByRole('slider', { name: 'Room Length' })).toHaveValue('21');
    await expect(b.getByRole('slider', { name: 'Room Width' })).toHaveValue('21');

    // Prevent HTTP saves during the reload edge; all reads and WebSocket messages still use the real server.
    await aContext.route('**/api/share/galleries', route => route.request().method() === 'PUT' ? route.abort('failed') : route.continue());
    await gateA.cut(); await widthA.focus(); await widthA.press('ArrowRight');
    await expect(a.getByRole('status').filter({ hasText: 'Draft retained in this tab' })).toBeVisible();
    await gateA.resume(); await a.reload();
    await expect(a.getByRole('alertdialog', { name: 'Recover work from this tab?' })).toBeVisible({ timeout: 45_000 });
    await a.screenshot({ path: testInfo.outputPath('3d-reload-draft-choice.png') });
    await aContext.unroute('**/api/share/galleries');
    await a.getByRole('button', { name: 'Restore my draft', exact: true }).click();
    await expect.poll(async () => {
      const gallery = (await (await request.get(`/api/galleries/${id}`, { headers })).json()).gallery;
      const room = JSON.parse(gallery.sceneJson).roomSize; return [room.width, room.length];
    }).toEqual([22, 21]);
    await a.screenshot({ path: testInfo.outputPath('3d-restored-and-saved.png') });
    await testInfo.attach('network-evidence', { body: JSON.stringify({ aJoins: gateA.joined, bJoins: gateB.joined, savedRoom: { width: 22, length: 21 }, realWebGL: true }), contentType: 'application/json' });
  } finally {
    await aContext.close(); await bContext.close();
    expect((await request.delete(`/api/galleries/${id}`, { headers })).ok()).toBe(true);
  }
});
