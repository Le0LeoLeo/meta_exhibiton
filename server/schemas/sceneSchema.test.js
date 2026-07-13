import { describe, expect, it } from 'vitest';
import { sanitizeSceneSnapshot } from './sceneSchema.js';

function createValidScene(overrides = {}) {
  return {
    roomSize: {
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
    },
    items: [
      {
        id: 'painting-01',
        type: 'painting',
        position: [0, 2.5, -9.9],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: 'https://example.com/art.jpg',
        title: '城市記憶',
        artist: 'AI 策展',
        description: '一件關於城市記憶的展品。',
        frameWidth: 2.4,
        frameHeight: 1.6,
      },
    ],
    floorPlanElements: [
      {
        id: 'room-01',
        type: 'room',
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        scale: [24, 0.04, 20],
        color: '#dbeafe',
        isLocked: true,
      },
    ],
    wallMaterialOverrides: {},
    ...overrides,
  };
}

describe('sanitizeSceneSnapshot', () => {
  it('accepts a valid scene snapshot', () => {
    const scene = sanitizeSceneSnapshot(createValidScene());

    expect(scene.roomSize.width).toBe(24);
    expect(scene.items).toHaveLength(1);
    expect(scene.items[0].title).toBe('城市記憶');
    expect(scene.floorPlanElements[0].isLocked).toBe(true);
  });

  it('rejects scenes without roomSize', () => {
    const { roomSize: _roomSize, ...scene } = createValidScene();

    expect(() => sanitizeSceneSnapshot(scene)).toThrow(/roomSize/i);
  });

  it('rejects unknown item types', () => {
    const scene = createValidScene({
      items: [
        {
          id: 'unknown-01',
          type: 'hologram',
          position: [0, 1, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          content: '',
        },
      ],
    });

    expect(() => sanitizeSceneSnapshot(scene)).toThrow(/type/i);
  });

  it('rejects non-numeric item coordinates', () => {
    const scene = createValidScene({
      items: [
        {
          id: 'bad-position',
          type: 'pedestal',
          position: [0, 'far', 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          content: '',
        },
      ],
    });

    expect(() => sanitizeSceneSnapshot(scene)).toThrow(/position/i);
  });

  it('clamps oversized room dimensions to supported editor bounds', () => {
    const scene = sanitizeSceneSnapshot(createValidScene({
      roomSize: {
        ...createValidScene().roomSize,
        width: 200,
        length: 120,
        height: 20,
      },
    }));

    expect(scene.roomSize.width).toBe(40);
    expect(scene.roomSize.length).toBe(60);
    expect(scene.roomSize.height).toBe(8);
  });
});
