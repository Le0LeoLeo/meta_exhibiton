import type { ExhibitItem, FloorPlanElement, RoomSize, WallMaterialSettings } from '../features/metaverse-studio';

export type SceneSnapshot = {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
};

export type GalleryAtmosphere = 'bright' | 'spotlight' | 'warm';

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

function study(room: RoomSize, theme: string, title: string, index: number, side: number, z: number): ExhibitItem {
  const photo = theme === 'photo';
  return fixture('painting', [side * (room.width / 2 - 0.16), 2.55, z], `/templates/${theme}-${index + 1}.${photo ? 'jpg' : 'svg'}`, title, {
    rotation: [0, -side * Math.PI / 2, 0], frameWidth: photo ? 3.8 : 3.5, frameHeight: photo ? 2.85 : 2.8,
    imageAspectRatio: photo ? 4 / 3 : 1.25, frameStyle: photo ? 'modern' : 'floating',
    frameColor: '#343735', frameThickness: 0.045, frameDepth: 0.055,
    frameMatEnabled: photo, frameMatColor: '#f4f1eb', frameMatWidth: 0.14, frameGlassEnabled: false,
    artist: photo ? 'Unsplash · 攝影範例' : 'MetaEXB · 原創設計範例',
    description: photo ? `${title}：從光線、構圖與空間層次觀察這張照片。可替換為自己的攝影作品。` : `${title}：主題設計習作，可替換圖片、標題與作品說明，建立自己的策展敘事。`,
  });
}

function wallStudies(room: RoomSize, theme: string, titles: string[]): ExhibitItem[] {
  return titles.map((title, index) => {
    const item = study(room, theme, title, index, index < 4 ? -1 : 1, index % 2 ? 2.6 : -3.2);
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

function modernArtScene(): SceneSnapshot {
  // Official exhibitions also use these room dimensions for their curated artwork placements.
  const room = createBaseRoom({ width: 26, length: 22, wallColor: '#f5f2eb', floorColor: '#ede7dd' });
  const titles = ['色域流動', '幾何敘事', '流動邊界', '層疊節奏', '弧線之間', '空間留白'];
  const works = titles.map((title, index) => {
    const item = study(room, 'art', title, index, index < 5 ? -1 : 1, index === 4 ? 3 : -4);
    item.frameWidth = 3.75;
    item.frameHeight = 3;
    item.frameColor = '#c3b4a0';
    if (index < 3) {
      item.position = [(index - 1) * 6, 2.55, -room.length / 2 + 0.16];
      item.rotation = [0, 0, 0];
    }
    return item;
  });
  return themedRoom(room, '現代藝術畫廊', '色域與形體  /  FORM & COLOUR', '#514b43', [
    ...works,
    fixture('pedestal', [3.2, 0, -3.8], '/templates/ribbon-sculpture.glb', '環帶 · 立體習作', {
      rotation: [0, -0.35, 0], description: '金色環帶與平面作品互相呼應，四周留有完整觀賞動線。可替換自己的雕塑模型。',
    }),
    fixture('bench', [-4.2, 0, 2.5], '#a99276', '中央觀賞長椅', { scale: [1.3, 1, 1] }),
    fixture('lightstrip', [-5.5, 5.25, -5], '#fff0dc', '作品照明', { scale: [6, 0.06, 0.06], lightIntensity: 0.5 }),
  ]);
}

function techShowroomScene(): SceneSnapshot {
  const room = createBaseRoom({ width: 18, length: 16, wallColor: '#526573', floorColor: '#dfe5e6', environmentBrightness: 1.05 });
  const works = wallStudies(room, 'tech', ['連接架構', '智慧核心', '感測網路', '資料路徑', '介面系統', '未來應用']);
  for (const work of works) { work.frameStyle = 'borderless'; work.frameMatEnabled = false; }
  return themedRoom(room, '科技展示廳', '介面 · 互動 · 未來生活', '#eef5f4', [
    ...works,
    fixture('pedestal', [-3.1, 0, -1.7], '/templates/display-device.glb', '智慧終端 · 互動展示', {
      rotation: [0, 0.25, 0], description: '智慧螢幕置於簡潔操作展台，示範互動產品與規格介紹。',
    }),
    fixture('pedestal', [3.1, 0, 0.5], '/templates/display-device.glb', '智慧終端 · 結構展示', {
      rotation: [0, -0.55, 0], description: '從側面觀察產品結構，與對側互動展示形成錯落動線。',
    }),
    fixture('lightstrip', [0, 5.15, -4.8], '#b8edee', '線性展示照明', { scale: [9, 0.055, 0.055], lightIntensity: 0.55 }),
    fixture('bench', [-5.1, 0, 4.7], '#6e858d', '體驗區座位'),
  ]);
}

function historyMuseumScene(): SceneSnapshot {
  const room = createBaseRoom({ width: 22, length: 20, wallColor: '#667164', floorColor: '#ede3d1',
    floorTextureUrl: '/textures/template-oak.svg', environmentBrightness: 1.02 });
  const collection = [
    { id: 437881, title: '持水壺的年輕女子', artist: 'Johannes Vermeer · 約 1662', ratio: 555 / 624 },
    { id: 45434, title: '神奈川沖浪裏', artist: '葛飾北齋 · 約 1830–32', ratio: 600 / 403 },
    { id: 436535, title: '有柏樹的麥田', artist: 'Vincent van Gogh · 1889', ratio: 599 / 477 },
    { id: 436965, title: '阿讓特伊花園中的莫內一家', artist: 'Edouard Manet · 1874', ratio: 599 / 377 },
    { id: 436534, title: '玫瑰', artist: 'Vincent van Gogh · 1890', ratio: 494 / 624 },
    { id: 55739, title: '下總登戶', artist: '葛飾北齋 · 1832–33', ratio: 599 / 421 },
  ];
  const works = collection.map((work, index) => {
    const item = study(room, 'art', work.title, index, index < 5 ? -1 : 1, index === 4 ? 3 : -3.5);
    if (index < 3) { item.position = [(index - 1) * 5.6, 2.45, -room.length / 2 + 0.16]; item.rotation = [0, 0, 0]; }
    return { ...item, content: `/demo/met-${work.id}.jpg`, artist: work.artist,
      description: 'The Met Open Access 公有領域作品。比較不同時代的構圖、媒材與生活場景；可替換為自己的館藏介紹。',
      externalUrl: `https://www.metmuseum.org/art/collection/search/${work.id}`,
      frameStyle: 'classic' as const, frameColor: '#a98c57', frameInnerColor: '#e5d7b9', frameThickness: 0.07,
      frameWidth: 2.5 * work.ratio, frameHeight: 2.5, imageAspectRatio: work.ratio,
    };
  });
  return themedRoom(room, '歷史博物館', '時間的收藏  /  A STUDY OF TIME', '#f0e9db', [
    ...works,
    fixture('bench', [0, 0, -1.5], '#766049', '館藏觀賞長椅', { scale: [1.65, 1, 1] }),
    fixture('bench', [-5.6, 0, 3.4], '#766049', '側廳觀賞長椅', { rotation: [0, Math.PI / 2, 0] }),
    fixture('lightstrip', [0, 5.15, -6.8], '#fff0d7', '館藏洗牆照明', { scale: [11, 0.055, 0.055], lightIntensity: 0.55 }),
  ]);
}

function fashionScene(): SceneSnapshot {
  const room = createBaseRoom({ width: 18, length: 18, wallColor: '#ead9d1', floorColor: '#f5eddf',
    floorTextureUrl: '/textures/template-oak.svg', environmentBrightness: 1.05 });
  const works = wallStudies(room, 'fashion', ['經典廓形', '柔和剪裁', '流動線條', '立體結構', '織物層次', '系列終章']);
  for (const work of works) { work.frameColor = '#b3987d'; work.frameStyle = 'floating'; }
  return themedRoom(room, '時尚展示間', 'ATELIER  /  廓形 · 材質 · 工藝', '#674f48', [
    ...works,
    fixture('pedestal', [-2.7, 0, -2.4], '/templates/atelier-bag.glb', '皮具設計習作', {
      rotation: [0, 0.25, 0], description: '配件置於簡潔方形展示台，以暖色空間襯托材質與工藝。',
    }),
    fixture('pedestal', [2.7, 0, -0.7], '/templates/atelier-bag.glb', '配件細節展示', {
      rotation: [0, -0.7, 0], scale: [0.85, 0.85, 0.85], description: '從另一角度觀看手袋結構，可加入材質與工藝介紹。',
    }),
    fixture('sofa', [-4.8, 0, 4.4], '#b48e7e', '品牌交流座位'),
    fixture('plant', [6.5, 0, 5.5], '#69765c', '入口綠意'),
    fixture('lightstrip', [0, 5.15, -3.5], '#ffe8d5', '暖色作品照明', { scale: [7, 0.055, 0.055], lightIntensity: 0.5 }),
  ]);
}

function photographyScene(): SceneSnapshot {
  const room = createBaseRoom({ width: 20, length: 18, wallColor: '#5c6262', floorColor: '#e1ded7', environmentBrightness: 1.0 });
  return themedRoom(room, '攝影作品展', '光的切片  /  LIGHT & LANDSCAPE', '#f4f0e8', [
    ...wallStudies(room, 'photo', ['霓虹夜色', '水岸倒影', '森林光線', '海的節奏', '城市切片', '山的輪廓']),
    fixture('bench', [0, 0, 0.5], '#9f8970', '作品觀賞長椅', { scale: [1.6, 1, 1] }),
    fixture('lightstrip', [-7.7, 5.15, -0.3], '#fff4e2', '左側洗牆照明', { rotation: [0, Math.PI / 2, 0], scale: [9, 0.055, 0.055], lightIntensity: 0.5 }),
    fixture('lightstrip', [7.7, 5.15, -0.3], '#fff4e2', '右側洗牆照明', { rotation: [0, Math.PI / 2, 0], scale: [9, 0.055, 0.055], lightIntensity: 0.5 }),
  ]);
}

function carScene(): SceneSnapshot {
  const room = createBaseRoom({ width: 32, length: 20, wallColor: '#e3e8e8', floorColor: '#e6e9e8', environmentBrightness: 1.08 });
  const works = wallStudies(room, 'car', ['造型語言', '車身比例', '輪圈設計', '座艙結構', '燈光識別', '設計總覽']);
  for (const work of works) { work.frameStyle = 'borderless'; work.frameWidth = 4.2; work.frameHeight = 3.36; work.position[1] = 2.35; }
  // Place the two visual boards behind separate vehicle bays, leaving the central aisle open.
  works[0].position[0] = -6.3;
  works[1].position[0] = 6.3;
  return themedRoom(room, '汽車展示廳', 'DESIGN STUDIO  /  形體 · 比例 · 移動', '#435760', [
    ...works,
    fixture('pedestal', [-4.4, 0, -3.5], '/templates/concept-car.glb', '概念車 · 造型展示', {
      rotation: [0, 0.4, 0], description: '原創概念車置於低矮展示平台，按車輛尺度呈現，四周保留步行觀賞空間。沒有真實品牌或性能宣稱。',
    }),
    fixture('pedestal', [4.4, 0, -2.8], '/templates/concept-car.glb', '概念車 · 結構展示', {
      rotation: [0, -0.55, 0], description: '以另一角度呈現概念車比例與輪廓，可替換為自己的車輛模型。',
    }),
    fixture('sofa', [-8, 0, 5.3], '#65747b', '設計交流座位'),
    fixture('chair', [-4.5, 0, 5.3], '#a5adae', '洽談座位', { rotation: [0, -Math.PI / 2, 0] }),
    fixture('plant', [11.2, 0, 5.8], '#60765e', '入口綠植'),
    fixture('lightstrip', [-5.2, 5.15, -2.8], '#edf7ff', '車輛展示照明 A', { scale: [6, 0.055, 0.055], lightIntensity: 0.55 }),
    fixture('lightstrip', [5.2, 5.15, -0.3], '#edf7ff', '車輛展示照明 B', { scale: [6, 0.055, 0.055], lightIntensity: 0.55 }),
  ]);
}

const sceneFactories: Record<string, () => SceneSnapshot> = {
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

export function getTemplateSceneJson(templateTitle: string, atmosphere: GalleryAtmosphere = getDefaultGalleryAtmosphere(templateTitle)): string | undefined {
  const scene = Object.hasOwn(sceneFactories, templateTitle) ? sceneFactories[templateTitle]() : null;
  if (!scene) return undefined;
  return JSON.stringify(applyAtmosphere(scene, atmosphere));
}

