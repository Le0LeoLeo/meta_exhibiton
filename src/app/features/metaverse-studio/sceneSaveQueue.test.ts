import { describe, expect, it } from 'vitest';
import { createSceneSaveQueue } from './sceneSaveQueue';

describe('scene saves', () => {
  it('serializes manual and automatic saves using the acknowledged revision', async () => {
    const queue = createSceneSaveQueue();
    const revisions: number[] = [];
    let revision = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const automatic = queue.run(async () => { revisions.push(revision); await gate; revision += 1; });
    const manual = queue.run(async () => { revisions.push(revision); revision += 1; });
    await Promise.resolve();
    expect(revisions).toEqual([0]);
    expect(queue.busy).toBe(true);
    release();
    await Promise.all([automatic, manual]);
    expect(revisions).toEqual([0, 1]);
  });

  it('allows an explicit retry after a failed request', async () => {
    const queue = createSceneSaveQueue();
    await expect(queue.run(async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    await expect(queue.run(async () => 'saved')).resolves.toBe('saved');
  });
});
