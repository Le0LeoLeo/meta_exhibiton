const ROOM_SIZE = {
  width: 20,
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
};

export function createEvaluationScene() {
  return {
    roomSize: { ...ROOM_SIZE },
    items: [
      {
        id: 'painting-user-1',
        type: 'painting',
        position: [0, 2.5, -9.65],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: '/api/media/assets/user-1',
        assetId: 'asset-user-1',
        assetUrl: '/api/media/assets/user-1',
        thumbnailUrl: '/api/media/assets/user-1/thumbnail',
        title: 'Harbour Memory',
        artist: 'Student A',
        description: 'A photograph of the harbour.',
        frameWidth: 2.1,
        frameHeight: 1.45,
      },
      {
        id: 'painting-user-2',
        type: 'painting',
        position: [9.65, 2.5, 2],
        rotation: [0, -Math.PI / 2, 0],
        scale: [1, 1, 1],
        content: '/api/media/assets/user-2',
        assetId: 'asset-user-2',
        assetUrl: '/api/media/assets/user-2',
        title: 'Street Memory',
        artist: 'Student B',
        description: 'A photograph of an old street.',
      },
      {
        id: 'ai-title',
        type: 'text',
        position: [0, 4.2, 9.65],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
        content: 'City Memory',
      },
      {
        id: 'light-old',
        type: 'lightstrip',
        position: [0, 3.5, -9.55],
        rotation: [0, 0, 0],
        scale: [1.8, 0.12, 0.12],
        content: '#ffe08a',
        lightIntensity: 0.5,
      },
    ],
    floorPlanElements: [],
    wallMaterialOverrides: {},
  };
}

function response(summary, operations, title = 'City Memory Revised') {
  return {
    exhibition: {
      title,
      curatorialStatement: 'The revised route preserves the student artworks and improves presentation.',
      sections: [],
    },
    operationPlan: { schemaVersion: 1, summary, operations },
  };
}

export const exhibitionBuilderCases = [
  {
    id: 'rebalance-two-wall-route',
    prompt: '把入口作品移到西牆，改善兩面牆之間的參觀動線。',
    providerResponse: response('Move the entrance artwork to the west wall.', [{
      type: 'move-item',
      itemId: 'painting-user-1',
      position: [-9.65, 2.5, -2],
      rotation: [0, Math.PI / 2, 0],
    }]),
    expectedOperationTypes: ['move-item'],
    expectedMovedItemId: 'painting-user-1',
  },
  {
    id: 'clarify-student-label',
    prompt: '保留作品與圖片，只把第一件作品的說明改得更清楚。',
    providerResponse: response('Clarify the first artwork label.', [{
      type: 'update-item-copy',
      itemId: 'painting-user-1',
      description: 'A student photograph tracing Macau harbour life across generations.',
    }]),
    expectedOperationTypes: ['update-item-copy'],
    expectedDescription: 'A student photograph tracing Macau harbour life across generations.',
  },
  {
    id: 'add-focused-lighting',
    prompt: '不要移動作品，為第二件作品增加較柔和的重點照明。',
    providerResponse: response('Add a soft light above the second artwork.', [{
      type: 'add-light',
      id: 'light-user-2-soft',
      position: [9.55, 3.5, 2],
      rotation: [0, -Math.PI / 2, 0],
      scale: [1.8, 0.12, 0.12],
      content: '#fef3c7',
      lightIntensity: 0.45,
    }]),
    expectedOperationTypes: ['add-light'],
    expectedAddedItemId: 'light-user-2-soft',
  },
  {
    id: 'warm-room-style',
    prompt: '將白盒展廳調成溫暖但不昏暗的博物館風格。',
    providerResponse: response('Apply a warmer room palette.', [{
      type: 'update-room-style',
      wallColor: '#f5efe4',
      wallMaterialPreset: 'wood',
      floorColor: '#3b2f2f',
      environmentBrightness: 0.6,
    }]),
    expectedOperationTypes: ['update-room-style'],
    expectedWallColor: '#f5efe4',
  },
  {
    id: 'replace-generated-title-and-add-seat',
    prompt: '移除舊的 AI 標題，並在中央加入一張長椅；學生作品不可刪除。',
    providerResponse: response('Remove the generated title and add seating.', [{
      type: 'remove-generated-item',
      itemId: 'ai-title',
    }, {
      type: 'add-furniture',
      id: 'ai-bench-center',
      itemType: 'bench',
      position: [0, 0, 2.5],
      rotation: [0, Math.PI, 0],
      scale: [2.4, 1.1, 1],
      content: '#8b5e3c',
    }]),
    expectedOperationTypes: ['remove-generated-item', 'add-furniture'],
    expectedAddedItemId: 'ai-bench-center',
    expectedRemovedItemId: 'ai-title',
  },
];
