import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button';

describe('buttonVariants touch targets', () => {
  it.each(['default', 'sm', 'lg', 'icon'] as const)('gives the %s size a 44px minimum height on touch screens', (size) => {
    expect(buttonVariants({ size }).split(' ')).toContain('pointer-coarse:min-h-11');
  });

  it('gives icon buttons a 44px minimum width on touch screens', () => {
    expect(buttonVariants({ size: 'icon' }).split(' ')).toContain('pointer-coarse:min-w-11');
  });

  it('keeps the touch minimum when callers override the height', () => {
    const classes = buttonVariants({ size: 'sm', className: 'h-7' }).split(' ');
    expect(classes).toContain('h-7');
    expect(classes).toContain('pointer-coarse:min-h-11');
  });
});
