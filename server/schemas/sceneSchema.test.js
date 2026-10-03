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
        frameStyle: 'natural',
        frameColor: '#8b5e3c',
        frameInnerColor: '#d6aa72',
        frameThickness: 0.11,
        frameDepth: 0.09,
        frameMatEnabled: true,
        frameMatColor: '#f5f0e5',
        frameMatWidth: 0.12,
        frameGlassEnabled: true,
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
  it('preserves image aspect, media identity and frame dimensions through JSON storage', () => {
    const source = createValidScene();
    Object.assign(source.items[0], {
      imageAspectRatio: 1 / 10000,
      assetId: 'uploaded-artwork',
      content: '/api/media/uploaded-artwork',
      assetUrl: '/api/media/uploaded-artwork',
    });
    const scene = sanitizeSceneSnapshot(source);
    expect(sanitizeSceneSnapshot(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
    expect(scene.items[0]).toMatchObject(source.items[0]);
  });

  it('leaves imageAspectRatio absent for legacy scenes', () => {
    expect(sanitizeSceneSnapshot(createValidScene()).items[0]).not.toHaveProperty('imageAspectRatio');
  });

  it('preserves public work context and source notes through scene JSON round trips', () => {
    const source = createValidScene();
    source.items[0].workContext = {
      contribution: 'I designed the display.',
      process: 'I tested two layouts.',
      outcome: 'The final layout leaves an aisle.',
      reflection: 'Next time I will prototype sooner.',
      sources: [{ label: 'Project note', url: 'https://example.com/project', excerpt: 'Supplied excerpt.' }],
    };
    const scene = sanitizeSceneSnapshot(source);
    expect(scene.items[0].workContext).toEqual(source.items[0].workContext);
    expect(sanitizeSceneSnapshot(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  });

  it('keeps legacy scenes without work context valid', () => {
    expect(sanitizeSceneSnapshot(createValidScene()).items[0]).not.toHaveProperty('workContext');
  });

  it.each([
    ['contribution', { contribution: 'x'.repeat(2001) }],
    ['process', { process: 'x'.repeat(2001) }],
    ['outcome', { outcome: 'x'.repeat(2001) }],
    ['reflection', { reflection: 'x'.repeat(2001) }],
    ['source count', { sources: Array.from({ length: 6 }, (_, index) => ({ label: `Source ${index}` })) }],
    ['empty source label', { sources: [{ label: '   ' }] }],
    ['source label', { sources: [{ label: 'x'.repeat(201) }] }],
    ['source excerpt', { sources: [{ label: 'Source', excerpt: 'x'.repeat(2001) }] }],
    ['source URL length', { sources: [{ label: 'Source', url: `https://${'x'.repeat(1000)}` }] }],
    ['non-http source URL', { sources: [{ label: 'Source', url: 'javascript:alert(1)' }] }],
  ])('rejects invalid work context bounds (%s)', (_name, workContext) => {
    expect(() => sanitizeSceneSnapshot(createValidScene({
      items: [{ ...createValidScene().items[0], workContext }],
    }))).toThrow(/workContext|source/i);
  });

  it.each([0, -1, NaN, Infinity, null, '1.5'])('rejects invalid image aspect %s', (imageAspectRatio) => {
    const scene = createValidScene();
    scene.items[0].imageAspectRatio = imageAspectRatio;
    expect(() => sanitizeSceneSnapshot(scene)).toThrow(/imageAspectRatio/);
  });

  it('accepts a valid scene snapshot', () => {
    const scene = sanitizeSceneSnapshot(createValidScene());

    expect(scene.roomSize.width).toBe(24);
    expect(scene.items).toHaveLength(1);
    expect(scene.items[0].frameStyle).toBe('natural');
    expect(scene.items[0].frameGlassEnabled).toBe(true);
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

  it('accepts the interactive decoration item types', () => {
    const types = ['chair', 'sofa', 'floorlamp', 'cabinet', 'turntable', 'fountain'];
    const scene = sanitizeSceneSnapshot(createValidScene({
      items: types.map((type, index) => ({
        id: `${type}-${index}`,
        type,
        position: [index, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: '#64748b',
      })),
    }));

    expect(scene.items.map((item) => item.type)).toEqual(types);
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
