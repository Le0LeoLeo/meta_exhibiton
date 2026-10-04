import { describe, expect, it } from 'vitest';
import { shouldPreserveDrawingBuffer } from './CanvasScene';

describe('CanvasScene drawing buffer policy', () => {
  it('disables the expensive retained buffer for public viewing', () => {
    expect(shouldPreserveDrawingBuffer('view', false)).toBe(false);
  });

  it('retains the buffer for editor and floor-plan capture workflows', () => {
    expect(shouldPreserveDrawingBuffer('edit', false)).toBe(true);
    expect(shouldPreserveDrawingBuffer('floor-plan', true)).toBe(true);
  });
});
