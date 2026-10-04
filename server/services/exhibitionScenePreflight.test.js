import { describe, expect, it } from 'vitest';
import { inspectWallClearance } from './exhibitionScenePreflight.js';

describe('wall display preflight', () => {
  const painting = { id: 'art', type: 'painting', position: [0, 2.5, -7.65], frameWidth: 2.1, frameHeight: 1.45 };
  const label = { id: 'label', type: 'text', content: 'Duplicate caption', position: [0, 1.45, -7.65], textFontSize: 0.2 };
  const inspect = (items) => inspectWallClearance({roomSize: {width: 20, length: 16}, items});
  it('detects a separate label overlapping the built-in painting caption', () => {
    expect(inspect([painting, label])).toEqual([expect.objectContaining({severity: 'high', resolution: 'automatic'})]);
  });
  it('allows a sign above the frame and captions on different walls', () => {
    expect(inspect([painting, {...label, position: [0, 4.1, -7.65]}])).toEqual([]);
    expect(inspect([painting, {...label, position: [9.65, 2.5, 0]}])).toEqual([]);
  });
});
