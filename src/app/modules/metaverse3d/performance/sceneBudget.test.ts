import { describe, expect, it } from 'vitest';
import { analyzeSceneBudget, SCENE_BUDGET_THRESHOLDS } from './sceneBudget';

function makeItems(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    type: 'painting',
    content: `https://cdn.example.com/image-${index}.jpg`,
    ...overrides,
  }));
}

describe('analyzeSceneBudget', () => {
  it('reports a small scene as info with its compact counts', () => {
    const result = analyzeSceneBudget({
      items: [
        { id: 'image', type: 'painting', content: '/art/one.jpg', fileMimeType: 'image/jpeg' },
        { id: 'video', type: 'painting', content: '/art/clip.mp4', fileMimeType: 'video/mp4' },
        { id: 'model', type: 'pedestal', content: '/models/work.glb' },
        { id: 'light', type: 'spotlight', content: '#fff' },
      ],
      floorPlanElements: [{ id: 'room' }],
    });

    expect(result.level).toBe('info');
    expect(result.counts).toEqual({ items: 4, images: 1, videos: 1, models: 1, floorPlanElements: 1, lights: 1 });
    expect(result.suggestions).toEqual([]);
  });

  it('deduplicates asset URLs and ignores colors or text', () => {
    const result = analyzeSceneBudget({
      items: [
        { type: 'painting', content: '/same.webp?size=large' },
        { type: 'painting', content: '/same.webp?size=large' },
        { type: 'pedestal', content: '/model.gltf#scene' },
        { type: 'text', content: '展覽介紹' },
        { type: 'partition', content: '#ffffff' },
      ],
      floorPlanElements: [],
    });

    expect(result.counts.images).toBe(1);
    expect(result.counts.models).toBe(1);
    expect(result.counts.videos).toBe(0);
  });

  it('uses warning at the warning threshold and gives a concrete reduction target', () => {
    const result = analyzeSceneBudget({
      items: makeItems(SCENE_BUDGET_THRESHOLDS.items.warning, { type: 'text', content: '展品說明' }),
      floorPlanElements: [],
    });

    expect(result.level).toBe('warning');
    expect(result.metrics.items.level).toBe('warning');
    expect(result.suggestions.join(' ')).toContain(`${SCENE_BUDGET_THRESHOLDS.items.warning - 1}`);
  });

  it('promotes the overall level to critical when any metric reaches its critical threshold', () => {
    const repeatedModelItems = makeItems(SCENE_BUDGET_THRESHOLDS.models.critical, {
      type: 'pedestal',
      fileMimeType: 'model/gltf-binary',
    }).map((item, index) => ({ ...item, content: `/models/model-${index}.glb` }));

    const result = analyzeSceneBudget({ items: repeatedModelItems, floorPlanElements: [] });

    expect(result.level).toBe('critical');
    expect(result.metrics.models.level).toBe('critical');
    expect(result.suggestions.join(' ')).toContain('LOD');
  });

  it('counts common light item types without requiring a root lights array', () => {
    const result = analyzeSceneBudget({
      items: [
        { type: 'lightstrip', content: '#fff' },
        { type: 'spotlight', content: '#fff' },
        { type: 'chandelier', content: '#fff' },
        { type: 'painting', content: '/art.jpg' },
      ],
      floorPlanElements: [],
    });

    expect(result.counts.lights).toBe(3);
  });
});
