import type { ExhibitItem, FloorPlanElement, RoomSize, WallMaterialSettings } from '../modules/metaverse3d/types';

type SceneSnapshot = {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
};

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createBaseRoom = (overrides?: Partial<RoomSize>): RoomSize => ({
  width: 24,
  length: 20,
  height: 6,
  wallThickness: 0.1,
  wallColor: '#f8fafc',
  wallMaterialPreset: 'paint',
  wallTextureUrl: '/textures/wall-paint.svg',
  wallTextureTiling: 3,
  wallRoughness: 0.35,
  wallMetalness: 0.08,
  wallBumpScale: 0.04,
  wallEnvIntensity: 0.9,
  wallOpacity: 0.98,
  wallTransmission: 0,
  wallIor: 1.45,
  floorColor: '#0f172a',
  floorTextureUrl: '/textures/wall-concrete.svg',
  floorTextureTiling: 2.5,
  floorRoughness: 0.55,
  floorMetalness: 0.18,
  environmentBrightness: 0.45,
  ...overrides,
});

const createDefaultFloorPlan = (width: number, length: number): FloorPlanElement[] => [
  {
    id: makeId('room'),
    type: 'room',
    position: [0, 0.02, 0],
    rotation: [0, 0, 0],
    scale: [width, 0.04, length],
    color: '#dbeafe',
    isLocked: true,
  },
];

function modernArtScene(): SceneSnapshot {
  const roomSize = createBaseRoom({
    width: 26,
    length: 22,
    wallColor: '#f8fafc',
    floorColor: '#111827',
    environmentBrightness: 0.56,
    floorRoughness: 0.42,
  });

  const items: ExhibitItem[] = [
    {
      id: makeId('text'),
      type: 'text',
      position: [0, 4.8, -10.6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: '現代藝術畫廊',
      textFontFamily: 'sans',
      textColor: '#f8fafc',
      textFontSize: 0.8,
      textBackboardEnabled: true,
      textBackboardColor: '#111827',
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [-6, 2.4, -10.9],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=1200',
      title: '色域流動',
      artist: '當代策展組',
      description: '以色塊與節奏創造沉浸式觀看體驗。',
      frameWidth: 2.4,
      frameHeight: 1.6,
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [0, 2.4, -10.9],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&q=80&w=1200',
      title: '幾何敘事',
      artist: '當代策展組',
      description: '幾何結構與光影的平衡。',
      frameWidth: 2.4,
      frameHeight: 1.6,
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [6, 2.4, -10.9],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1578301978018-3005759f48f7?auto=format&fit=crop&q=80&w=1200',
      title: '流動邊界',
      artist: '當代策展組',
      description: '有機線條與空間感並置。',
      frameWidth: 2.4,
      frameHeight: 1.6,
    },
    {
      id: makeId('pedestal'),
      type: 'pedestal',
      position: [-3, 0.9, -1],
      rotation: [0, 0.4, 0],
      scale: [1.2, 1.2, 1.2],
      content: '',
      title: '雕塑展台 A',
      description: '中央展示雕塑用台座。',
    },
    {
      id: makeId('pedestal'),
      type: 'pedestal',
      position: [3, 0.9, 1.2],
      rotation: [0, -0.3, 0],
      scale: [1.2, 1.2, 1.2],
      content: '',
      title: '雕塑展台 B',
      description: '中央展示雕塑用台座。',
    },
    {
      id: makeId('lightstrip'),
      type: 'lightstrip',
      position: [0, 5.5, -8],
      rotation: [0, 0, 0],
      scale: [4, 0.12, 0.12],
      content: '#ffe08a',
      lightIntensity: 0.72,
    },
  ];

  return {
    roomSize,
    items,
    floorPlanElements: createDefaultFloorPlan(roomSize.width, roomSize.length),
    wallMaterialOverrides: {},
  };
}

function techShowroomScene(): SceneSnapshot {
  const roomSize = createBaseRoom({
    width: 28,
    length: 22,
    wallColor: '#1f2937',
    floorColor: '#0b1020',
    wallMaterialPreset: 'metal',
    wallRoughness: 0.28,
    wallMetalness: 0.42,
    environmentBrightness: 0.38,
  });

  const items: ExhibitItem[] = [
    {
      id: makeId('text'),
      type: 'text',
      position: [0, 4.8, -10.5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: '科技展示廳',
      textFontFamily: 'mono',
      textColor: '#67e8f9',
      textFontSize: 0.85,
      textIsBold: true,
      textBackboardEnabled: true,
      textBackboardColor: '#0f172a',
    },
    {
      id: makeId('partition'),
      type: 'partition',
      position: [-6, roomSize.height / 2, -1],
      rotation: [0, 0.22, 0],
      scale: [7, roomSize.height, 0.24],
      content: '#334155',
    },
    {
      id: makeId('partition'),
      type: 'partition',
      position: [6, roomSize.height / 2, -1],
      rotation: [0, -0.22, 0],
      scale: [7, roomSize.height, 0.24],
      content: '#334155',
    },
    {
      id: makeId('pedestal'),
      type: 'pedestal',
      position: [-4, 0.9, -4],
      rotation: [0, 0.4, 0],
      scale: [1.3, 1.3, 1.3],
      content: '',
      title: '智慧終端 A',
      description: '互動產品展示點。',
    },
    {
      id: makeId('pedestal'),
      type: 'pedestal',
      position: [0, 0.9, -4],
      rotation: [0, 0, 0],
      scale: [1.3, 1.3, 1.3],
      content: '',
      title: '智慧終端 B',
      description: '互動產品展示點。',
    },
    {
      id: makeId('pedestal'),
      type: 'pedestal',
      position: [4, 0.9, -4],
      rotation: [0, -0.4, 0],
      scale: [1.3, 1.3, 1.3],
      content: '',
      title: '智慧終端 C',
      description: '互動產品展示點。',
    },
    {
      id: makeId('neon'),
      type: 'neon',
      position: [-8.5, 3.2, -10.7],
      rotation: [0, 0, 0],
      scale: [2.5, 1, 0.3],
      content: '#22d3ee',
    },
    {
      id: makeId('neon'),
      type: 'neon',
      position: [8.5, 3.2, -10.7],
      rotation: [0, 0, 0],
      scale: [2.5, 1, 0.3],
      content: '#60a5fa',
    },
    {
      id: makeId('lightstrip'),
      type: 'lightstrip',
      position: [0, 5.6, -6],
      rotation: [0, 0, 0],
      scale: [8, 0.12, 0.12],
      content: '#67e8f9',
      lightIntensity: 1.05,
    },
  ];

  return {
    roomSize,
    items,
    floorPlanElements: createDefaultFloorPlan(roomSize.width, roomSize.length),
    wallMaterialOverrides: {},
  };
}

function historyMuseumScene(): SceneSnapshot {
  const roomSize = createBaseRoom({
    width: 24,
    length: 24,
    wallColor: '#7f1d1d',
    floorColor: '#422006',
    wallMaterialPreset: 'wood',
    wallRoughness: 0.5,
    wallMetalness: 0.05,
    environmentBrightness: 0.4,
  });

  const items: ExhibitItem[] = [
    {
      id: makeId('text'),
      type: 'text',
      position: [0, 4.9, -11.4],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: '歷史博物館',
      textFontFamily: 'serif',
      textColor: '#f5e7c6',
      textFontSize: 0.82,
      textIsBold: true,
      textBackboardEnabled: true,
      textBackboardColor: '#4a1010',
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [-7, 2.5, -11.6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1577083552431-6e5fd75fcf78?auto=format&fit=crop&q=80&w=1200',
      title: '古典廳景',
      artist: '典藏影像',
      description: '重現歷史場景的展示作品。',
      frameWidth: 2.2,
      frameHeight: 1.5,
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [0, 2.5, -11.6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&q=80&w=1200',
      title: '文物廊道',
      artist: '典藏影像',
      description: '以廊道串聯各時代文物。',
      frameWidth: 2.2,
      frameHeight: 1.5,
    },
    {
      id: makeId('painting'),
      type: 'painting',
      position: [7, 2.5, -11.6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&q=80&w=1200',
      title: '典藏展間',
      artist: '典藏影像',
      description: '經典藏品展示空間。',
      frameWidth: 2.2,
      frameHeight: 1.5,
    },
    {
      id: makeId('column'),
      type: 'column',
      position: [-8.5, 1.5, -5],
      rotation: [0, 0, 0],
      scale: [1.1, 3.3, 1.1],
      content: '#d6c19a',
    },
    {
      id: makeId('column'),
      type: 'column',
      position: [8.5, 1.5, -5],
      rotation: [0, 0, 0],
      scale: [1.1, 3.3, 1.1],
      content: '#d6c19a',
    },
    {
      id: makeId('rug'),
      type: 'rug',
      position: [0, 0.06, -2],
      rotation: [0, 0, 0],
      scale: [3.6, 1, 2.2],
      content: '#7c2d12',
    },
    {
      id: makeId('chandelier'),
      type: 'chandelier',
      position: [0, 5.3, -2],
      rotation: [0, 0, 0],
      scale: [1.15, 1.15, 1.15],
      content: '#fde68a',
    },
  ];

  return {
    roomSize,
    items,
    floorPlanElements: createDefaultFloorPlan(roomSize.width, roomSize.length),
    wallMaterialOverrides: {},
  };
}

export function getTemplateSceneJson(templateTitle: string): string | undefined {
  const scene =
    templateTitle === '現代藝術畫廊'
      ? modernArtScene()
      : templateTitle === '科技展示廳'
        ? techShowroomScene()
        : templateTitle === '歷史博物館'
          ? historyMuseumScene()
          : null;

  if (!scene) return undefined;
  return JSON.stringify(scene);
}
