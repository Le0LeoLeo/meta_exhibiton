import type { ExhibitItem, FloorPlanElement, RoomSize, WallMaterialSettings } from '../features/metaverse-studio';

export type SceneSnapshot = {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
};

export type GalleryAtmosphere = 'bright' | 'spotlight' | 'warm';

/** Template copy is written in Traditional Chinese with an English counterpart. */
export type TemplateLanguage = 'en' | 'zh';
type Pick = (zh: string, en: string) => string;
const picker = (language: TemplateLanguage): Pick => (zh, en) => (language === 'en' ? en : zh);

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createBaseRoom = (overrides?: Partial<RoomSize>): RoomSize => ({
  width: 22, length: 20, height: 5.6, wallThickness: 0.1,
  wallColor: '#f4f1eb', wallMaterialPreset: 'paint', wallTextureUrl: '/textures/template-wall.svg',
  wallTextureTiling: 3, wallRoughness: 0.92, wallMetalness: 0, wallBumpScale: 0,
  wallEnvIntensity: 0.35, wallOpacity: 1, wallTransmission: 0, wallIor: 1.45,
  floorColor: '#f1eee7', floorTextureUrl: '/textures/template-stone.svg', floorTextureTiling: 3,
  floorRoughness: 0.94, floorMetalness: 0, environmentBrightness: 1.0,
  ...overrides,
});

const createDefaultFloorPlan = (width: number, length: number): FloorPlanElement[] => [{
  id: makeId('room'), type: 'room', position: [0, 0.02, 0], rotation: [0, 0, 0],
  scale: [width, 0.04, length], color: '#dbeafe', isLocked: true,
}];

function fixture(type: ExhibitItem['type'], position: ExhibitItem['position'], content: string, title: string, extra: Partial<ExhibitItem> = {}): ExhibitItem {
  return { id: makeId(type), type, position, rotation: [0, 0, 0], scale: [1, 1, 1], content, title,
    ...(type === 'pedestal' ? { modelOffset: [0, 0, 0] as [number, number, number] } : {}), ...extra };
}

function study(L: Pick, room: RoomSize, theme: string, title: string, index: number, side: number, z: number): ExhibitItem {
  const photo = theme === 'photo';
  return fixture('painting', [side * (room.width / 2 - 0.16), 2.55, z], `/templates/${theme}-${index + 1}.${photo ? 'jpg' : 'svg'}`, title, {
    rotation: [0, -side * Math.PI / 2, 0], frameWidth: photo ? 3.8 : 3.5, frameHeight: photo ? 2.85 : 2.8,
    imageAspectRatio: photo ? 4 / 3 : 1.25, frameStyle: photo ? 'modern' : 'floating',
    frameColor: '#343735', frameThickness: 0.045, frameDepth: 0.055,
    frameMatEnabled: photo, frameMatColor: '#f4f1eb', frameMatWidth: 0.14, frameGlassEnabled: false,
    artist: photo ? L('Unsplash · 攝影範例', 'Unsplash · Sample photograph') : L('Paidea · 原創設計範例', 'Paidea · Original design sample'),
    description: photo
      ? L(`${title}：從光線、構圖與空間層次觀察這張照片。可替換為自己的攝影作品。`, `${title}: look at the light, composition and depth in this photograph. Replace it with your own work.`)
      : L(`${title}：主題設計習作，可替換圖片、標題與作品說明，建立自己的策展敘事。`, `${title}: a sample design study. Replace the image, title and description to tell your own story.`),
  });
}

function wallStudies(L: Pick, room: RoomSize, theme: string, titles: string[]): ExhibitItem[] {
  return titles.map((title, index) => {
    const item = study(L, room, theme, title, index, index < 4 ? -1 : 1, index % 2 ? 2.6 : -3.2);
    if (index < 2) {
      item.position = [index ? 3.3 : -3.3, 2.55, -room.length / 2 + 0.16];
      item.rotation = [0, 0, 0];
    }
    return item;
  });
}

function themedRoom(room: RoomSize, title: string, subtitle: string, color: string, items: ExhibitItem[]): SceneSnapshot {
  return {
    roomSize: room, floorPlanElements: createDefaultFloorPlan(room.width, room.length), wallMaterialOverrides: {},
    items: [
      fixture('text', [0, 4.75, -room.length / 2 + 0.2], title, title, {
        textFontSize: 0.46, textColor: color, textFontFamily: 'sans', textIsBold: false, textBackboardEnabled: false,
      }),
      fixture('text', [0, 4.25, -room.length / 2 + 0.2], subtitle, subtitle, {
        textFontSize: 0.14, textColor: color, textFontFamily: 'sans', textBackboardEnabled: false,
      }),
      ...items,
    ],
  };
}

function modernArtScene(L: Pick): SceneSnapshot {
  // Official exhibitions also use these room dimensions for their curated artwork placements.
  const room = createBaseRoom({ width: 26, length: 22, wallColor: '#f5f2eb', floorColor: '#ede7dd' });
  const titles = [L('色域流動', 'Colour Field'), L('幾何敘事', 'Geometric Narrative'), L('流動邊界', 'Fluid Edges'), L('層疊節奏', 'Layered Rhythm'), L('弧線之間', 'Between Arcs'), L('空間留白', 'Open Space')];
  const works = titles.map((title, index) => {
    const item = study(L, room, 'art', title, index, index < 5 ? -1 : 1, index === 4 ? 3 : -4);
    item.frameWidth = 3.75;
    item.frameHeight = 3;
    item.frameColor = '#c3b4a0';
    if (index < 3) {
      item.position = [(index - 1) * 6, 2.55, -room.length / 2 + 0.16];
      item.rotation = [0, 0, 0];
    }
    return item;
  });
  return themedRoom(room, L('現代藝術畫廊', 'Art Learning Gallery'), L('色域與形體  /  FORM & COLOUR', 'FORM & COLOUR'), '#514b43', [
    ...works,
    fixture('pedestal', [3.2, 0, -3.8], '/templates/ribbon-sculpture.glb', L('環帶 · 立體習作', 'Ribbon · Sculpture study'), {
      rotation: [0, -0.35, 0], description: L('金色環帶與平面作品互相呼應，四周留有完整觀賞動線。可替換自己的雕塑模型。', 'A gold ribbon that echoes the wall works, with space to walk around it. Replace it with your own sculpture model.'),
    }),
    fixture('bench', [-4.2, 0, 2.5], '#a99276', L('中央觀賞長椅', 'Central viewing bench'), { scale: [1.3, 1, 1] }),
    fixture('lightstrip', [-5.5, 5.25, -5], '#fff0dc', L('作品照明', 'Artwork lighting'), { scale: [6, 0.06, 0.06], lightIntensity: 0.5 }),
  ]);
}

function techShowroomScene(L: Pick): SceneSnapshot {
  const room = createBaseRoom({ width: 18, length: 16, wallColor: '#526573', floorColor: '#dfe5e6', environmentBrightness: 1.05 });
  const works = wallStudies(L, room, 'tech', [L('連接架構', 'Connected Structure'), L('智慧核心', 'Smart Core'), L('感測網路', 'Sensor Network'), L('資料路徑', 'Data Pathways'), L('介面系統', 'Interface System'), L('未來應用', 'Future Uses')]);
  for (const work of works) { work.frameStyle = 'borderless'; work.frameMatEnabled = false; }
  return themedRoom(room, L('科技展示廳', 'STEM Project Gallery'), L('介面 · 互動 · 未來生活', 'INTERFACE · INTERACTION · FUTURE LIVING'), '#eef5f4', [
    ...works,
    fixture('pedestal', [-3.1, 0, -1.7], '/templates/display-device.glb', L('智慧終端 · 互動展示', 'Smart device · Interactive display'), {
      rotation: [0, 0.25, 0], description: L('智慧螢幕置於簡潔操作展台，示範互動產品與規格介紹。', 'A smart screen on a simple stand, showing how to present an interactive prototype and its specifications.'),
    }),
    fixture('pedestal', [3.1, 0, 0.5], '/templates/display-device.glb', L('智慧終端 · 結構展示', 'Smart device · Structure view'), {
      rotation: [0, -0.55, 0], description: L('從側面觀察產品結構，與對側互動展示形成錯落動線。', 'View the device structure from the side; it staggers the route with the display opposite.'),
    }),
    fixture('lightstrip', [0, 5.15, -4.8], '#b8edee', L('線性展示照明', 'Linear display lighting'), { scale: [9, 0.055, 0.055], lightIntensity: 0.55 }),
    fixture('bench', [-5.1, 0, 4.7], '#6e858d', L('體驗區座位', 'Hands-on area seating')),
  ]);
}

function historyMuseumScene(L: Pick): SceneSnapshot {
  const room = createBaseRoom({ width: 22, length: 20, wallColor: '#667164', floorColor: '#ede3d1',
    floorTextureUrl: '/textures/template-oak.svg', environmentBrightness: 1.02 });
  const collection = [
    { id: 437881, title: L('持水壺的年輕女子', 'Young Woman with a Water Pitcher'), artist: L('Johannes Vermeer · 約 1662', 'Johannes Vermeer · c. 1662'), ratio: 555 / 624 },
    { id: 45434, title: L('神奈川沖浪裏', 'Under the Wave off Kanagawa'), artist: L('葛飾北齋 · 約 1830–32', 'Katsushika Hokusai · c. 1830–32'), ratio: 600 / 403 },
    { id: 436535, title: L('有柏樹的麥田', 'Wheat Field with Cypresses'), artist: 'Vincent van Gogh · 1889', ratio: 599 / 477 },
    { id: 436965, title: L('阿讓特伊花園中的莫內一家', 'The Monet Family in Their Garden at Argenteuil'), artist: 'Edouard Manet · 1874', ratio: 599 / 377 },
    { id: 436534, title: L('玫瑰', 'Roses'), artist: 'Vincent van Gogh · 1890', ratio: 494 / 624 },
    { id: 55739, title: L('下總登戶', 'Noboto in Shimosa Province'), artist: L('葛飾北齋 · 1832–33', 'Katsushika Hokusai · 1832–33'), ratio: 599 / 421 },
  ];
  const works = collection.map((work, index) => {
    const item = study(L, room, 'art', work.title, index, index < 5 ? -1 : 1, index === 4 ? 3 : -3.5);
    if (index < 3) { item.position = [(index - 1) * 5.6, 2.45, -room.length / 2 + 0.16]; item.rotation = [0, 0, 0]; }
    return { ...item, content: `/demo/met-${work.id}.jpg`, artist: work.artist,
      description: L('The Met Open Access 公有領域作品。比較不同時代的構圖、媒材與生活場景；可替換為自己的館藏介紹。', 'A public-domain work from The Met Open Access. Compare composition, materials and everyday scenes across periods; replace it with your own source.'),
      externalUrl: `https://www.metmuseum.org/art/collection/search/${work.id}`,
      frameStyle: 'classic' as const, frameColor: '#a98c57', frameInnerColor: '#e5d7b9', frameThickness: 0.07,
      frameWidth: 2.5 * work.ratio, frameHeight: 2.5, imageAspectRatio: work.ratio,
    };
  });
  return themedRoom(room, L('歷史博物館', 'History Inquiry Gallery'), L('時間的收藏  /  A STUDY OF TIME', 'A STUDY OF TIME'), '#f0e9db', [
    ...works,
    fixture('bench', [0, 0, -1.5], '#766049', L('館藏觀賞長椅', 'Collection viewing bench'), { scale: [1.65, 1, 1] }),
    fixture('bench', [-5.6, 0, 3.4], '#766049', L('側廳觀賞長椅', 'Side gallery bench'), { rotation: [0, Math.PI / 2, 0] }),
    fixture('lightstrip', [0, 5.15, -6.8], '#fff0d7', L('館藏洗牆照明', 'Collection wall wash lighting'), { scale: [11, 0.055, 0.055], lightIntensity: 0.55 }),
  ]);
}

function fashionScene(L: Pick): SceneSnapshot {
  const room = createBaseRoom({ width: 18, length: 18, wallColor: '#ead9d1', floorColor: '#f5eddf',
    floorTextureUrl: '/textures/template-oak.svg', environmentBrightness: 1.05 });
  const works = wallStudies(L, room, 'fashion', [L('經典廓形', 'Classic Silhouette'), L('柔和剪裁', 'Soft Tailoring'), L('流動線條', 'Flowing Lines'), L('立體結構', 'Sculpted Form'), L('織物層次', 'Layered Fabric'), L('系列終章', 'Final Look')]);
  for (const work of works) { work.frameColor = '#b3987d'; work.frameStyle = 'floating'; }
  return themedRoom(room, L('時尚展示間', 'Design Project Gallery'), L('ATELIER  /  廓形 · 材質 · 工藝', 'ATELIER  /  FORM · MATERIAL · CRAFT'), '#674f48', [
    ...works,
    fixture('pedestal', [-2.7, 0, -2.4], '/templates/atelier-bag.glb', L('皮具設計習作', 'Leather bag design study'), {
      rotation: [0, 0.25, 0], description: L('配件置於簡潔方形展示台，以暖色空間襯托材質與工藝。', 'An accessory on a simple square plinth; the warm room brings out material and craft.'),
    }),
    fixture('pedestal', [2.7, 0, -0.7], '/templates/atelier-bag.glb', L('配件細節展示', 'Accessory detail view'), {
      rotation: [0, -0.7, 0], scale: [0.85, 0.85, 0.85], description: L('從另一角度觀看手袋結構，可加入材質與工藝介紹。', 'See the bag structure from another angle; add notes on materials and making.'),
    }),
    fixture('sofa', [-4.8, 0, 4.4], '#b48e7e', L('品牌交流座位', 'Discussion seating')),
    fixture('plant', [6.5, 0, 5.5], '#69765c', L('入口綠意', 'Entrance plant')),
    fixture('lightstrip', [0, 5.15, -3.5], '#ffe8d5', L('暖色作品照明', 'Warm artwork lighting'), { scale: [7, 0.055, 0.055], lightIntensity: 0.5 }),
  ]);
}

function photographyScene(L: Pick): SceneSnapshot {
  const room = createBaseRoom({ width: 20, length: 18, wallColor: '#5c6262', floorColor: '#e1ded7', environmentBrightness: 1.0 });
  return themedRoom(room, L('攝影作品展', 'Visual Storytelling Gallery'), L('光的切片  /  LIGHT & LANDSCAPE', 'LIGHT & LANDSCAPE'), '#f4f0e8', [
    ...wallStudies(L, room, 'photo', [L('霓虹夜色', 'Neon Night'), L('水岸倒影', 'Waterfront Reflections'), L('森林光線', 'Forest Light'), L('海的節奏', 'Rhythm of the Sea'), L('城市切片', 'City Slices'), L('山的輪廓', 'Mountain Outline')]),
    fixture('bench', [0, 0, 0.5], '#9f8970', L('作品觀賞長椅', 'Viewing bench'), { scale: [1.6, 1, 1] }),
    fixture('lightstrip', [-7.7, 5.15, -0.3], '#fff4e2', L('左側洗牆照明', 'Left wall wash lighting'), { rotation: [0, Math.PI / 2, 0], scale: [9, 0.055, 0.055], lightIntensity: 0.5 }),
    fixture('lightstrip', [7.7, 5.15, -0.3], '#fff4e2', L('右側洗牆照明', 'Right wall wash lighting'), { rotation: [0, Math.PI / 2, 0], scale: [9, 0.055, 0.055], lightIntensity: 0.5 }),
  ]);
}

function carScene(L: Pick): SceneSnapshot {
  const room = createBaseRoom({ width: 32, length: 20, wallColor: '#e3e8e8', floorColor: '#e6e9e8', environmentBrightness: 1.08 });
  const works = wallStudies(L, room, 'car', [L('造型語言', 'Form Language'), L('車身比例', 'Body Proportions'), L('輪圈設計', 'Wheel Design'), L('座艙結構', 'Cabin Structure'), L('燈光識別', 'Light Signature'), L('設計總覽', 'Design Overview')]);
  for (const work of works) { work.frameStyle = 'borderless'; work.frameWidth = 4.2; work.frameHeight = 3.36; work.position[1] = 2.35; }
  // Place the two visual boards behind separate vehicle bays, leaving the central aisle open.
  works[0].position[0] = -6.3;
  works[1].position[0] = 6.3;
  return themedRoom(room, L('汽車展示廳', 'Engineering Project Gallery'), L('DESIGN STUDIO  /  形體 · 比例 · 移動', 'DESIGN STUDIO  /  FORM · PROPORTION · MOTION'), '#435760', [
    ...works,
    fixture('pedestal', [-4.4, 0, -3.5], '/templates/concept-car.glb', L('概念車 · 造型展示', 'Concept car · Form display'), {
      rotation: [0, 0.4, 0], description: L('原創概念車置於低矮展示平台，按車輛尺度呈現，四周保留步行觀賞空間。沒有真實品牌或性能宣稱。', 'An original concept car at full scale on a low platform, with room to walk around it. No real brand or performance claims.'),
    }),
    fixture('pedestal', [4.4, 0, -2.8], '/templates/concept-car.glb', L('概念車 · 結構展示', 'Concept car · Structure display'), {
      rotation: [0, -0.55, 0], description: L('以另一角度呈現概念車比例與輪廓，可替換為自己的車輛模型。', 'Shows the concept car proportions from another angle; replace it with your own vehicle model.'),
    }),
    fixture('sofa', [-8, 0, 5.3], '#65747b', L('設計交流座位', 'Design discussion seating')),
    fixture('chair', [-4.5, 0, 5.3], '#a5adae', L('洽談座位', 'Meeting chair'), { rotation: [0, -Math.PI / 2, 0] }),
    fixture('plant', [11.2, 0, 5.8], '#60765e', L('入口綠植', 'Entrance plant')),
    fixture('lightstrip', [-5.2, 5.15, -2.8], '#edf7ff', L('車輛展示照明 A', 'Vehicle lighting A'), { scale: [6, 0.055, 0.055], lightIntensity: 0.55 }),
    fixture('lightstrip', [5.2, 5.15, -0.3], '#edf7ff', L('車輛展示照明 B', 'Vehicle lighting B'), { scale: [6, 0.055, 0.055], lightIntensity: 0.55 }),
  ]);
}

const sceneFactories: Record<string, (L: Pick) => SceneSnapshot> = {
  '現代藝術畫廊': modernArtScene,
  '科技展示廳': techShowroomScene,
  '歷史博物館': historyMuseumScene,
  '時尚展示間': fashionScene,
  '攝影作品展': photographyScene,
  '汽車展示廳': carScene,
};

function applyAtmosphere(scene: SceneSnapshot, atmosphere: GalleryAtmosphere): SceneSnapshot {
  if (atmosphere === 'bright') return scene;
  const warm = atmosphere === 'warm';
  return {
    ...scene,
    roomSize: {
      ...scene.roomSize,
      wallColor: warm ? '#715238' : '#23434a',
      wallTextureUrl: warm ? '/textures/template-wall-warm.svg' : '/textures/template-wall-spotlight.svg',
      wallMaterialPreset: 'paint', wallRoughness: 0.96, wallMetalness: 0, wallEnvIntensity: 0.12,
      floorColor: warm ? '#68523e' : '#58524b',
      floorTextureUrl: warm ? '/textures/template-oak.svg' : '/textures/template-stone.svg',
      floorRoughness: 0.98, floorMetalness: 0,
      environmentBrightness: warm ? 0.38 : 0.34,
    },
    items: scene.items.map((item) => {
      if (item.type === 'text') return { ...item, textColor: warm ? '#f1dcc0' : '#e6efec' };
      if (item.type === 'lightstrip') return {
        ...item, content: warm ? '#ffdbad' : '#e2f0e9', lightIntensity: 0.18,
      };
      if (item.type === 'painting') return {
        ...item,
        // Product boards retain their edge-to-edge presentation in both moods.
        frameStyle: item.frameStyle === 'borderless' ? 'borderless' : warm ? 'classic' : 'modern',
        frameColor: warm ? '#b49864' : '#343a36',
        frameInnerColor: warm ? '#d2bd95' : '#7b827b',
        frameMatColor: warm ? '#e9dcc5' : '#e3e7df',
      };
      return { ...item };
    }),
  };
}

export function getDefaultGalleryAtmosphere(templateTitle: string): GalleryAtmosphere {
  if (templateTitle === '科技展示廳' || templateTitle === '攝影作品展') return 'spotlight';
  if (templateTitle === '歷史博物館' || templateTitle === '時尚展示間') return 'warm';
  return 'bright';
}

export function getTemplateSceneJson(
  templateTitle: string,
  atmosphere: GalleryAtmosphere = getDefaultGalleryAtmosphere(templateTitle),
  language: TemplateLanguage = 'zh',
): string | undefined {
  const scene = Object.hasOwn(sceneFactories, templateTitle) ? sceneFactories[templateTitle](picker(language)) : null;
  if (!scene) return undefined;
  return JSON.stringify(applyAtmosphere(scene, atmosphere));
}

