import { test as base, expect, type BrowserContext } from '@playwright/test';
import { applySceneOperationPlan } from '../server/services/exhibitionSceneOperations.js';
import sharp from 'sharp';
import fs from 'node:fs';
import { buildBuilderInput } from '../src/app/modules/metaverse3d/aiBuilder/buildBuilderInput';
import type { SceneSnapshot } from '../src/app/modules/metaverse3d/store/metaverseStoreTypes';
import { liveBuilderProbe } from './helpers/liveBuilderProbe';

// Close WebGL contexts and remove synthetic data in fixture teardown, whose
// budget is separate from the unchanged interaction/assertion timeout.
const test = base.extend<{
  cleanupGallery: (context: BrowserContext, id: string, headers: Record<string, string>) => void;
}>({
  cleanupGallery: async ({ request }, use) => {
    const resources: { context: BrowserContext; id: string; headers: Record<string, string> }[] = [];
    await use((context, id, headers) => { resources.push({ context, id, headers }); });
    for (const { context, id, headers } of resources) {
      try { await context.close(); }
      finally { expect((await request.delete(`/api/galleries/${id}`, { headers })).ok()).toBe(true); }
    }
  },
});

async function loginThroughApp(page: import('@playwright/test').Page, returnTo = '/') {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').fill('creator@example.invalid');
  await page.locator('#login-password').fill('SyntheticPassword2026!');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  // Share routes load the 3D bundle before React commits navigation. Callers
  // await their existing editor/viewer readiness checks, then verify the URL.
  if (returnTo === '/') await expect(page).not.toHaveURL(/\/login/);
}

test('live six-zone agent completes rendering, visual review and saved scene', async ({browser,request,cleanupGallery},testInfo)=>{
  test.skip(process.env.METAEXB_LIVE_BUILDER_PROBE !== '1', 'Explicit opt-in paid synthetic provider acceptance');
  test.setTimeout(900000);
  const login=await request.post('/api/auth/login',{data:{email:'creator@example.invalid',password:'SyntheticPassword2026!'}});
  expect(login.ok()).toBe(true);const headers={Authorization:`Bearer ${(await login.json()).token}`};
  const source={roomSize:{width:20,length:20,height:5,wallThickness:0.1,environmentBrightness:1},items:[
    {id:'original-art',type:'painting',title:'Harbour',content:'/demo/harbour.svg',position:[9.65,2.5,0],rotation:[0,-Math.PI/2,0],scale:[1,1,1],frameWidth:4,frameHeight:2,isLocked:true},
  ],floorPlanElements:[],wallMaterialOverrides:{}};
  const created=await request.post('/api/galleries',{headers,data:{title:'Synthetic six-zone live acceptance',description:'Synthetic only',templateTitle:'Acceptance',templateImage:'/demo/harbour.svg',category:'art',sceneJson:JSON.stringify(source)}});
  expect(created.ok()).toBe(true);const id=(await created.json()).gallery.id;
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const versions:any[]=[];const reviews:any[]=[];let input:any;let current:any;
  try{
    await context.addInitScript(()=>{if(location.origin !== 'http://127.0.0.1:5193') return;localStorage.setItem('metaexpo-locale','en');localStorage.setItem('metaverse-exhibition-storage',JSON.stringify({version:7,state:{performanceMode:'performance'}}));});
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await loginThroughApp(page);
    const share=await request.post(`/api/galleries/${id}/share-link`,{headers,data:{role:'editor'}});expect(share.ok()).toBe(true);
    await context.route('**/api/ai/exhibition-builder/**',async route=>{
      const phase=new URL(route.request().url()).pathname.split('/').pop();
      const payload=route.request().method()==='POST'?route.request().postDataJSON():null;
      if(phase==='start'||phase==='revise'){
        if(phase==='start')input=payload;
        current=await liveBuilderProbe(phase,payload);versions.push(current);
        fs.writeFileSync(testInfo.outputPath(`session-${versions.length}.json`),JSON.stringify(current,null,2));
        console.log('LIVE generation',current.source,current.appliedOperationCount,current.warnings);
        return route.fulfill({json:current});
      }
      if(phase==='review'){
        expect(payload.screenshots).toHaveLength(16);
        for(const [index,shot]of payload.screenshots.entries())fs.writeFileSync(testInfo.outputPath(`round-${versions.length}-view-${index}.png`),Buffer.from(shot.dataUrl.split(',')[1],'base64'));
        const review=await liveBuilderProbe('review',{...payload,editMode:'complete',brief:input.prompt,exhibition:current.exhibition});reviews.push(review);
        Object.assign(current,{review:review.review,reviewSource:review.source,reviewStatus:review.status});
        fs.writeFileSync(testInfo.outputPath(`review-${reviews.length}.json`),JSON.stringify(review,null,2));
        console.log('LIVE review',JSON.stringify(review));return route.fulfill({json:review});
      }
      if(phase==='restore'){current=versions.find(version=>version.versionId===payload.targetVersionId)||current;return route.fulfill({json:{...current,input,versions}});}
      return route.fulfill({json:{...current,input,versions,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}});
    });
    await page.goto(`/virtual-gallery/share/${(await share.json()).share.token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button',{name:'Save Exhibition',exact:true})).toBeVisible({timeout:45000});
    await page.locator('button[aria-controls="editor-more-panel"]').click();await page.getByRole('button',{name:'AI Builder',exact:true}).click();
    await page.getByLabel('Exhibition brief',{exact:true}).fill('我想要分六個區，分別是ABCDEF區，每個區要有10個展品，且要有適量的裝飾');
    await page.getByRole('button',{name:'Send message',exact:true}).click();
    await expect(page.getByRole('button',{name:'Send message',exact:true})).toBeEnabled({timeout:780000});
    await expect(page.getByRole('button',{name:'Apply generated exhibition',exact:true})).toBeEnabled();
    expect(reviews.length).toBeGreaterThan(0);expect(reviews.at(-1)).toMatchObject({source:'qwen',status:'reviewed',review:{overallStatus:'pass'}});
    await page.screenshot({path:testInfo.outputPath('six-zone-reviewed.png'),fullPage:true});
    await page.getByRole('button',{name:'Apply generated exhibition',exact:true}).click();
    // Verify persisted data at the isolated API, without Vite's large-response proxy.
    const readScene=async()=>JSON.parse((await(await request.get(`http://127.0.0.1:5196/api/galleries/${id}`,{headers})).json()).gallery.sceneJson);
    await expect.poll(async()=>(await readScene()).items.filter((item:any)=>item.type==='painting').length,{timeout:90000}).toBe(61);
    const saved=await readScene();expect(saved.items.find((item:any)=>item.id==='original-art')).toMatchObject(source.items[0]);
    expect(saved.floorPlanElements.filter((item:any)=>item.type==='room')).toHaveLength(7);
    for(const section of versions[0].exhibition.sections)expect(section.exhibitIds.filter((id:string)=>saved.items.some((item:any)=>item.id===id))).toHaveLength(10);
    expect(errors).toEqual([]);
  }finally{cleanupGallery(context,id,headers);}
});

test('builder accepts the real frontend payload with site-relative artwork through the HTTP API', async ({ request }) => {
  const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const scene = { roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 },
    items: [{ id: 'url-regression-work', type: 'painting', content: '/demo/harbour.svg', assetUrl: '/demo/harbour.svg',
      position: [0, 2.5, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1] }], floorPlanElements: [], wallMaterialOverrides: {} } as SceneSnapshot;
  const input = buildBuilderInput(scene, { prompt: 'Preserve this artwork', style: 'white-box', exhibitCount: 1, complete: true, allowDestructive: false });
  expect(input.assets?.[0].imageUrl).toBe('/demo/harbour.svg');
  // Real route, schema, service and session database; the isolated server has no paid provider.
  const response = await request.post('/api/ai/exhibition-builder/start', { headers, data: input });
  expect(response.ok(), await response.text()).toBe(true);
  const session = await response.json();
  expect(session.scene.items[0].content).toBe('/demo/harbour.svg');
  expect(session.appliedOperationCount).toBe(0);
  const restored = await request.get(`/api/ai/exhibition-builder/sessions/${session.sessionId}`, { headers });
  expect(restored.ok()).toBe(true);
  const restoredInput = (await restored.json()).input;
  expect(restoredInput.assets[0].imageUrl).toBe('/demo/harbour.svg');
  expect(restoredInput.editMode).toBe('complete');
  expect(restoredInput.allowDestructive).toBe(false);
});

test('complete builder uploads assets, edits materials and geometry, and saves a rendered exhibition', async ({ browser, request, cleanupGallery }, testInfo) => {
  test.setTimeout(150_000);
  const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
  expect(login.ok()).toBe(true);
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  const source = { roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 }, items: [
    { id: 'original-art', type: 'painting', content: '/demo/harbour.svg', position: [0, 2.5, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1] },
    { id: 'original-title', type: 'text', content: 'Original exhibition', position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1], isLocked: true },
  ], floorPlanElements: [], wallMaterialOverrides: {} };
  const created = await request.post('/api/galleries', { headers, data: { title: 'Full builder acceptance', description: 'Synthetic only',
    templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg', category: 'art', sceneJson: JSON.stringify(source) } });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).gallery.id;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    await context.addInitScript(() => {
      if (location.origin !== 'http://127.0.0.1:5193') return;
      localStorage.setItem('metaexpo-locale', 'en'); localStorage.setItem('metaverse-exhibition-storage', JSON.stringify({ version: 7, state: { performanceMode: 'performance' } }));
      const create = document.createElement.bind(document);
      (window as any).__builderVideos = [];
      document.createElement = ((tag: string, options: any) => { const element = create(tag, options); if (tag === 'video') (window as any).__builderVideos.push(element); return element; }) as typeof document.createElement;
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const share = await request.post(`/api/galleries/${id}/share-link`, { headers, data: { role: 'editor' } });
    expect(share.ok()).toBe(true);
    const sharePath = `/virtual-gallery/share/${(await share.json()).share.token}`;
    await loginThroughApp(page, sharePath);
    await context.route('**/api/ai/exhibition-builder/start', async route => {
      const input = route.request().postDataJSON();
      expect(input.editMode).toBe('complete'); expect(input.allowDestructive).toBe(false);
      expect(input.currentScene.items.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(['original-art', 'original-title']));
      const image = input.editorAssets.find((asset: { label: string }) => asset.label === 'green-art.png');
      const model = input.editorAssets.find((asset: { label: string }) => asset.label === 'car.glb');
      const film = input.editorAssets.find((asset: { label: string }) => asset.label === 'film.webm');
      expect(image.assetId).toBeTruthy(); expect(model.assetId).toBeTruthy();
      const operations = [
        { type: 'edit-room', changes: { floorColor: '#e2e8f0', environmentBrightness: 1.2 } },
        { type: 'edit-item', itemId: 'original-art', changes: { frameColor: '#2563eb', frameGlassEnabled: false, title: 'Preserved harbour' } },
        { type: 'add-floor-element', element: { id: 'ai-main', type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0], scale: [20, 0.04, 20], isLocked: true } },
        { type: 'add-floor-element', element: { id: 'ai-east', type: 'room', position: [20, 0.02, 0], rotation: [0, 0, 0], scale: [20, 0.04, 20] } },
        { type: 'edit-wall-material', targetId: 'north', changes: { wallColor: '#dbeafe', wallRoughness: 0.8 } },
        { type: 'add-editor-item', item: { id: 'ai-wall', type: 'partition', content: '#f0e4cc', position: [0, 3, -3], rotation: [0, 0, 0], scale: [6, 6, 0.2] } },
        { type: 'edit-wall-material', targetId: 'ai-wall', changes: { wallColor: '#f0e4cc', wallRoughness: 0.8 } },
        { type: 'place-asset', id: 'ai-green', assetKey: image.key, position: [0, 2.5, 0] },
        { type: 'mount-on-partition', itemId: 'ai-green', partitionId: 'ai-wall', side: 'front', offset: -1.6, height: 2.5 },
        { type: 'place-asset', id: 'ai-film', assetKey: film.key, position: [0, 2.5, 0] },
        { type: 'mount-on-partition', itemId: 'ai-film', partitionId: 'ai-wall', side: 'front', offset: 1.6, height: 2.5 },
        { type: 'edit-item', itemId: 'ai-film', changes: { videoMuted: true, videoLoop: true, videoAutoplay: true } },
        { type: 'place-asset', id: 'ai-car', assetKey: model.key, position: [3, 0, 2], scale: [2, 2, 2] },
        { type: 'add-editor-item', item: { id: 'ai-bench', type: 'bench', position: [-4, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1], content: '#735744' } },
        { type: 'duplicate-items', copies: [{ itemId: 'ai-bench', id: 'ai-bench2', offset: [0, 0, 3] }] },
        { type: 'batch-transform', itemIds: ['ai-bench', 'ai-bench2'], mode: 'align', axis: 'x' },
      ];
      const result = applySceneOperationPlan(input.currentScene, { schemaVersion: 1, summary: 'Complete mixed editing', operations }, input);
      await route.fulfill({ json: { sessionId: 'synthetic-full', versionId: 'version-1', status: 'generated', source: 'qwen', warnings: [], appliedOperationCount: operations.length,
        exhibition: { title: 'Complete mixed editing', curatorialStatement: 'Selected media and exact editor tools', sections: [] }, scene: result.scene } });
    });
    await expect(page.getByTitle('Editing: Full builder acceptance', { exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Save Exhibition', exact: true })).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(`http://127.0.0.1:5193${sharePath}`);
    for (const name of ['Painting', 'Pedestal', 'Text', 'Partition wall']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await page.locator('button[aria-controls="editor-more-panel"]').click();
    await page.getByRole('button', { name: 'AI Builder', exact: true }).click();
    await page.locator('summary').filter({ hasText: 'Assets & settings' }).click();
    await expect(page.getByRole('checkbox', { name: /Allow requested removal/ })).not.toBeChecked();
    const green = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#00ff40' } }).png().toBuffer();
    const videoBytes = fs.readFileSync('e2e/fixtures/builder-film.webm');
    await page.getByLabel('Add images, videos or models', { exact: true }).setInputFiles([
      { name: 'green-art.png', mimeType: 'image/png', buffer: green },
      { name: 'car.glb', mimeType: 'application/octet-stream', buffer: fs.readFileSync('public/templates/concept-car.glb') },
      { name: 'film.webm', mimeType: 'video/webm', buffer: Buffer.from(videoBytes) },
    ]);
    // The app uploads this batch sequentially; verify each completed upload.
    for (const filename of ['green-art.png', 'car.glb', 'film.webm']) {
      await expect(page.getByText(filename, { exact: true })).toBeVisible();
    }
    await page.locator('summary').filter({ hasText: 'Assets & settings' }).click();
    await page.getByLabel('Exhibition brief', { exact: true }).fill('Use the selected car and picture, mount the picture on a new partition, add an east room and two benches, preserve originals.');
    await page.getByRole('button', { name: 'Generate exhibition', exact: true }).click();
    await expect(page.getByText('Complete mixed editing', { exact: true })).toBeVisible();
    const readScene = async () => JSON.parse((await (await request.get(`http://127.0.0.1:5196/api/galleries/${id}`, { headers })).json()).gallery.sceneJson);
    expect((await readScene()).items).toHaveLength(2);
    await page.screenshot({ path: testInfo.outputPath('full-builder-preview.png'), fullPage: true });
    await page.getByRole('button', { name: 'Apply generated exhibition', exact: true }).click();
    await expect.poll(async () => (await readScene()).items.length, { timeout: 30_000 }).toBe(8);
    const saved = await readScene();
    expect(saved.items.find((item: { id: string }) => item.id === 'original-title')).toMatchObject(source.items[1]);
    expect(saved.floorPlanElements).toHaveLength(3);
    expect(saved.wallMaterialOverrides['ai-wall'].wallColor).toBe('#f0e4cc');
    const car = saved.items.find((item: { id: string }) => item.id === 'ai-car');
    expect(saved.items.find((item: { id: string }) => item.id === 'ai-film')).toMatchObject({ videoAutoplay: true, videoMuted: true, videoLoop: true });
    expect(car.fileMimeType).toBe('model/gltf-binary'); expect(car.assetId).toBeTruthy();
    const delivered = await request.get(car.assetUrl, { headers, timeout: 15_000 }); expect(delivered.ok()).toBe(true);
    expect(await delivered.body()).toEqual(fs.readFileSync('public/templates/concept-car.glb'));
    expect((await request.post(`/api/galleries/${id}/publish`, { headers, data: {} })).ok()).toBe(true);
    await page.goto(`/exhibitions/${id}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
    await page.locator('canvas').first().click({ position: { x: 720, y: 700 } });
    await page.keyboard.down('s');
    await page.waitForTimeout(1500);
    await page.keyboard.up('s');
    await page.keyboard.press('Escape');
    console.log('Video renderer diagnostics', await page.evaluate(() => (window as any).__builderVideos.map((video: HTMLVideoElement) => ({ src: video.getAttribute('src'), readyState: video.readyState, paused: video.paused, time: video.currentTime, error: video.error?.message }))));
    let verified: Buffer | undefined;
    await expect.poll(async () => {
      const capture = await page.locator('canvas').first().screenshot();
      const { data, info } = await sharp(capture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let count = 0; let videoPixels = 0;
      for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] > 110 && data[i + 1] > data[i] + 45 && data[i + 1] > data[i + 2] + 45) count++;
      for (let i = 0; i < data.length; i += info.channels) if (data[i] > 110 && data[i + 2] > 110 && data[i + 1] < 85) videoPixels++;
      if (count > 200 && videoPixels > 200) verified = capture;
      return Math.min(count, videoPixels);
    }, { timeout: 45_000 }).toBeGreaterThan(200);
    fs.writeFileSync(testInfo.outputPath('full-builder-rendered.png'), verified!);
    expect(errors).toEqual([]);
  } finally { cleanupGallery(context, id, headers); }
});

for (const mobile of [false, true]) {
  test(mobile ? 'shared editor links retain read-only viewing on touch devices' : 'AI builder preserves its preview across panel toggles and applies only on confirmation', async ({ browser, request, cleanupGallery }, testInfo) => {
    test.setTimeout(120_000);
    const login = await request.post('/api/auth/login', { data: { email: 'creator@example.invalid', password: 'SyntheticPassword2026!' } });
    expect(login.ok()).toBe(true);
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };
    const artwork = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#00ff40' } }).png().toBuffer();
    const created = await request.post('/api/galleries', { headers, data: {
      title: 'Synthetic builder separation', description: 'Isolated acceptance', templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg', category: 'art',
      sceneJson: JSON.stringify({ roomSize: { width: 20, length: 20, height: 6, wallThickness: 0.1 },
        items: [...Array.from({ length: 9 }, (_, index) => ({ id: `work-${index}`, type: 'painting', content: `data:image/png;base64,${artwork.toString('base64')}`,
          position: [0, 2.5, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1], frameWidth: 2, frameHeight: 1.5 })),
          { id: 'existing-title', type: 'text', content: 'Existing exhibition title', position: [0, 4, -9.65], rotation: [0, 0, 0], scale: [1, 1, 1], isLocked: true }],
        floorPlanElements: [], wallMaterialOverrides: {} }),
    } });
    expect(created.ok()).toBe(true);
    const id = (await created.json()).gallery.id;
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 800 }, isMobile: mobile, hasTouch: mobile });
    try {
      const share = await request.post(`/api/galleries/${id}/share-link`, { headers, data: { role: 'editor' } });
      expect(share.ok()).toBe(true);
      await context.addInitScript(() => {
        if (location.origin !== 'http://127.0.0.1:5193') return;
        localStorage.setItem('metaexpo-locale', 'en');
        localStorage.setItem('metaverse-exhibition-storage', JSON.stringify({ version: 7, state: { performanceMode: 'performance' } }));
      });
      // Deterministic AI response; editor, store, WebGL and saving use their real implementations.
      let attempts = 0;
      await context.route('**/api/ai/exhibition-builder/start', async route => {
        const input = route.request().postDataJSON();
        expect(input.currentScene.items.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(Array.from({ length: 9 }, (_, i) => `work-${i}`)));
        if (++attempts === 1) {
          await route.fulfill({ json: { sessionId: 'synthetic-rejected', versionId: 'version-1', status: 'generated', source: 'fallback', appliedOperationCount: 0,
            warnings: ['DISPLAY_OCCUPIED: no free heading space'], scene: input.currentScene,
            exhibition: { title: 'Rejected preview', curatorialStatement: '', sections: [] } } });
          return;
        }
        const scene = structuredClone(input.currentScene);
        scene.roomSize.width = 24;
        scene.floorPlanElements = scene.floorPlanElements.map((element: any) => element.type === 'room'
          ? { ...element, scale: [scene.roomSize.width, element.scale[1], scene.roomSize.length] }
          : element);
        const spatial = applySceneOperationPlan(scene, { schemaVersion: 1, summary: 'Three wall sections and an open central aisle', operations: [
          { type: 'arrange-exhibition-sections', sections: ['north', 'west', 'east'].map((wall, index) => ({ wall, title: ['History', 'Present', 'Future'][index], itemIds: Array.from({ length: 3 }, (_, i) => `work-${index * 3 + i}`) })) },
          { type: 'create-exhibition-divider', id: 'ai-divider-browser', atZ: 6, aisleWidth: 2.4 },
        ] });
        await route.fulfill({ json: { sessionId: 'synthetic-builder', versionId: 'version-1', status: 'generated', source: 'fallback', warnings: [],
          exhibition: { title: 'Synthetic builder preview', curatorialStatement: 'Preview before applying', sections: [] }, scene: spatial.scene } });
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const sharePath = `/virtual-gallery/share/${(await share.json()).share.token}`;
      await loginThroughApp(page, sharePath);
      const savedWidth = async () => JSON.parse((await (await request.get(`http://127.0.0.1:5196/api/galleries/${id}`, { headers })).json()).gallery.sceneJson).roomSize.width;
      if (mobile) {
        await expect(page.getByRole('heading', { name: 'Select Viewing Mode', exact: true })).toBeVisible({ timeout: 45_000 });
        await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
      } else {
        await expect(page.getByTitle('Editing: Synthetic builder separation', { exact: true })).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole('button', { name: 'Save Exhibition', exact: true })).toBeVisible({ timeout: 45_000 });
      }
      await expect(page.locator('canvas').first()).toBeVisible();
      await expect(page).toHaveURL(`http://127.0.0.1:5193${sharePath}`);
      // A visible canvas element can precede renderer startup; the editor also has 2D canvases.
      await expect.poll(() => page.locator('canvas').evaluateAll(elements => elements.some(element => {
        const gl = (element as HTMLCanvasElement).getContext('webgl2') || (element as HTMLCanvasElement).getContext('webgl');
        return Boolean(gl && !gl.isContextLost() && gl.drawingBufferWidth > 0);
      })), { timeout: 30_000 }).toBe(true);
      if (mobile) {
        await expect(page.getByRole('button', { name: 'Save Exhibition', exact: true })).toHaveCount(0);
        await expect(page.locator('button[aria-controls="editor-more-panel"]')).toHaveCount(0);
        expect(await savedWidth()).toBe(20);
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath('touch-read-only.png'), fullPage: true });
        return;
      }
      const more = page.locator('button[aria-controls="editor-more-panel"]');
      await more.click();
      await page.getByRole('button', { name: 'AI Builder', exact: true }).click();
      await page.getByLabel('Exhibition brief', { exact: true }).fill('Make a wider exhibition');
      await page.getByRole('button', { name: 'Generate exhibition', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Generation did not complete');
      await expect(page.getByRole('button', { name: 'Apply generated exhibition', exact: true })).toBeDisabled();
      expect(await savedWidth()).toBe(20);
      await page.getByRole('button', { name: 'Generate exhibition', exact: true }).click();
      // Allow the asynchronous response/render under software WebGL; the
      // overall 120-second workflow deadline still bounds the entire test.
      await expect(page.getByText('Synthetic builder preview', { exact: true })).toBeVisible({ timeout: 45_000 });
      expect(await savedWidth()).toBe(20);
      // Close the active panel through its own control before using the toolbar
      // beneath it; the compact viewport can place More behind the builder.
      await page.getByRole('complementary', { name: 'AI Exhibition Builder', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.locator('#editor-builder-chat')).toHaveCount(0);
      await more.click();
      await page.getByRole('button', { name: 'AI Builder', exact: true }).click();
      await expect(page.getByText('Synthetic builder preview', { exact: true })).toBeVisible();
      await page.getByText('Synthetic builder preview', { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('builder-preview.png'), fullPage: true });
      await page.getByRole('button', { name: 'Apply generated exhibition', exact: true }).click();
      await expect(page.locator('#editor-more-panel')).toHaveCount(0);
      await expect.poll(savedWidth, { timeout: 30_000 }).toBe(24);
      const savedScene = JSON.parse((await (await request.get(`http://127.0.0.1:5196/api/galleries/${id}`, { headers })).json()).gallery.sceneJson);
      expect(savedScene.items.filter((item: { type: string }) => item.type === 'painting')).toHaveLength(9);
      expect(savedScene.items.filter((item: { type: string }) => item.type === 'partition')).toHaveLength(2);
      expect(savedScene.items.filter((item: { type: string }) => item.type === 'text')).toHaveLength(4);
      expect(savedScene.items.find((item: { id: string }) => item.id === 'existing-title')).toMatchObject({ content: 'Existing exhibition title', position: [0, 4, -9.65], isLocked: true });
      expect((await request.post(`/api/galleries/${id}/publish`, { headers, data: {} })).ok()).toBe(true);
      await page.goto(`/exhibitions/${id}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Solo mode, Agent NPC disabled', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm viewing mode selection', exact: true }).click();
      let verifiedCanvas: Buffer | undefined;
      await expect.poll(async () => {
        const capture = await page.locator('canvas').first().screenshot();
        const { data, info } = await sharp(capture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        let green = 0;
        for (let i = 0; i < data.length; i += info.channels) if (data[i + 1] > 100 && data[i + 1] > data[i] + 40 && data[i + 1] > data[i + 2] + 40) green++;
        if (green > 100) verifiedCanvas = capture;
        return green;
      }, { timeout: 45_000 }).toBeGreaterThan(100);
      fs.writeFileSync(testInfo.outputPath('verified-canvas.png'), verifiedCanvas!);
      await page.screenshot({ path: testInfo.outputPath('spatial-exhibition.png'), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      cleanupGallery(context, id, headers);
    }
  });
}
