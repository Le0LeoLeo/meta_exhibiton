// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'vite';
import { normalizeWatchFiles } from './normalizeWatchFiles';

describe('normalizeWatchFiles', () => {
  it('passes forward-slash paths to addWatchFile so Vite keeps /src/ module URLs', async () => {
    const plugin: Plugin = {
      name: 'scanner',
      transform(code) {
        this.addWatchFile('D:\\project\\src\\app\\Navigation.tsx');
        return `${code}!`;
      },
    };
    const [wrapped] = normalizeWatchFiles([plugin]);
    const context = { addWatchFile: vi.fn(), marker: 'ctx', getMarker() { return this.marker; } };

    const result = await (wrapped.transform as (this: unknown, code: string, id: string) => unknown).call(context, 'css', 'index.css');

    expect(result).toBe('css!');
    expect(context.addWatchFile).toHaveBeenCalledWith('D:/project/src/app/Navigation.tsx');
  });

  it('keeps the rest of the plugin context working', async () => {
    const plugin: Plugin = { name: 'reader', transform() { return (this as unknown as { getMarker(): string }).getMarker(); } };
    const [wrapped] = normalizeWatchFiles([plugin]);
    const context = { addWatchFile: vi.fn(), marker: 'ctx', getMarker() { return this.marker; } };

    expect(await (wrapped.transform as (this: unknown) => unknown).call(context)).toBe('ctx');
  });

  it('leaves plugins without a transform function untouched', () => {
    const plugin: Plugin = { name: 'plain', transform: { handler: () => null } };
    expect(normalizeWatchFiles([plugin])[0]).toBe(plugin);
  });
});
