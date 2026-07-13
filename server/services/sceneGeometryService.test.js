import { describe, expect, it } from 'vitest';
import { normalizeSceneGeometry } from './sceneGeometryService.js';

function createScene(items = []) {
  return {
    roomSize: {
      width: 20,
      length: 16,
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
    items,
    floorPlanElements: [
      {
        id: 'room-01',
        type: 'room',
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        scale: [20, 0.04, 16],
        color: '#dbeafe',
        isLocked: true,
      },
    ],
    wallMaterialOverrides: {},
  };
}

describe('normalizeSceneGeometry', () => {
  it('moves an out-of-bounds painting onto the nearest wall', () => {
    const { scene, warnings } = normalizeSceneGeometry(createScene([
      {
        id: 'painting-01',
        type: 'painting',
        position: [99, 12, 99],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: 'https://example.com/art.jpg',
      },
    ]));

    expect(scene.items[0].position[0]).toBeCloseTo(9.65);
    expect(scene.items[0].position[1]).toBeCloseTo(2.5);
    expect(scene.items[0].rotation[1]).toBeCloseTo(-Math.PI / 2);
    expect(warnings).toContain('Adjusted painting-01 painting placement to the nearest wall.');
  });

  it('moves floor objects back inside the room with wall clearance', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'pedestal-01',
        type: 'pedestal',
        position: [20, 9, -20],
        rotation: [0, 0, 0],
        scale: [1.2, 1.2, 1.2],
        content: '',
      },
    ]));

    expect(scene.items[0].position).toEqual([8.8, 0, -6.8]);
  });

  it('keeps generated floor decorations grounded using renderer origins', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      { id: 'bench-01', type: 'bench', position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
      { id: 'plant-01', type: 'plant', position: [2, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
      { id: 'sculpture-01', type: 'sculpture', position: [4, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
      { id: 'rug-01', type: 'rug', position: [6, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
    ]));

    expect(scene.items.find((item) => item.id === 'bench-01')?.position[1]).toBe(0);
    expect(scene.items.find((item) => item.id === 'plant-01')?.position[1]).toBe(0);
    expect(scene.items.find((item) => item.id === 'sculpture-01')?.position[1]).toBe(0);
    expect(scene.items.find((item) => item.id === 'rug-01')?.position[1]).toBe(0.01);
  });

  it('keeps generated paintings clear of wall geometry and frame depth', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'painting-01',
        type: 'painting',
        position: [0, 2.5, -8],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: 'https://example.com/art.jpg',
      },
    ]));

    expect(scene.items[0].position[2]).toBeLessThanOrEqual(-7.65);
  });

  it('keeps generated wall text backboards clear of wall geometry', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'ai-title',
        type: 'text',
        position: [0, 4.4, 7.92],
        rotation: [0, Math.PI, 0],
        scale: [1, 1, 1],
        content: '澳門博物館：城市記憶與空間敘事',
        textBackboardEnabled: true,
      },
    ]));

    expect(scene.items[0].position[2]).toBeLessThanOrEqual(7.65);
    expect(scene.items[0].rotation[1]).toBeCloseTo(Math.PI);
  });

  it('keeps generated wall text mounted to the target wall', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'section-01-title',
        type: 'text',
        position: [9.85, 4.1, 0],
        rotation: [0, -Math.PI / 2, 0],
        scale: [1, 1, 1],
        content: '海港',
      },
    ]));

    expect(scene.items[0].position[0]).toBeLessThanOrEqual(9.65);
    expect(scene.items[0].rotation[1]).toBeCloseTo(-Math.PI / 2);
  });

  it('does not snap freestanding text to a wall just because it has a front-facing rotation', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'custom-note',
        type: 'text',
        position: [0, 2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        content: 'Center note',
      },
    ]));

    expect(scene.items[0].position).toEqual([0, 2, 0]);
  });

  it('keeps generated wall lightstrips mounted near their paintings', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'light-01',
        type: 'lightstrip',
        position: [0, 3.35, -7.55],
        rotation: [0, 0, 0],
        scale: [1.8, 0.12, 0.12],
        content: '#ffe08a',
        lightIntensity: 0.62,
      },
    ]));

    expect(scene.items[0].position[2]).toBeCloseTo(-7.55);
    expect(scene.items[0].position[1]).toBeCloseTo(3.35);
  });

  it('spreads overlapping floor objects apart', () => {
    const { scene, warnings } = normalizeSceneGeometry(createScene([
      { id: 'pedestal-01', type: 'pedestal', position: [0, 0.9, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
      { id: 'pedestal-02', type: 'pedestal', position: [0, 0.9, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '' },
    ]));

    expect(scene.items[1].position[0]).not.toBe(0);
    expect(scene.items[1].position[2]).not.toBe(0);
    expect(warnings).toContain('Spread overlapping floor item pedestal-02.');
  });

  it('clamps lightstrip intensity', () => {
    const { scene } = normalizeSceneGeometry(createScene([
      {
        id: 'light-01',
        type: 'lightstrip',
        position: [0, 8, 0],
        rotation: [0, 0, 0],
        scale: [2, 0.12, 0.12],
        content: '#ffe08a',
        lightIntensity: 9,
      },
    ]));

    expect(scene.items[0].position[1]).toBe(5.5);
    expect(scene.items[0].lightIntensity).toBe(1.2);
  });

  it('handles empty scenes without adding warnings', () => {
    const { scene, warnings } = normalizeSceneGeometry(createScene());

    expect(scene.items).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
