import { describe, expect, it, vi } from 'vitest';
import { createUploadQueue } from './uploadQueue';

describe('upload queue', () => {
  it('limits active uploads across successive batches and continues after failure', async () => {
    const queue = createUploadQueue(2);
    const finish: Array<() => void> = [];
    let active = 0;
    let peak = 0;
    const job = () => new Promise<void>((resolve) => {
      active += 1;
      peak = Math.max(peak, active);
      finish.push(() => { active -= 1; resolve(); });
    });
    const results = [queue.add(job), queue.add(job), queue.add(() => Promise.reject(new Error('failed'))).catch(() => 'failed'), queue.add(job)];
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    finish[0]();
    await vi.waitFor(() => expect(finish).toHaveLength(3));
    finish[1](); finish[2]();
    expect((await Promise.all(results))[2]).toBe('failed');
    expect(peak).toBe(2);
  });
  it('stops queued uploads without starting them after route disposal', async () => {
    const queue = createUploadQueue(1);
    let release!: () => void;
    const first = queue.add(() => new Promise<void>((resolve) => { release = resolve; }));
    const queued = vi.fn(async () => 'should not run');
    const rejected = queue.add(queued).catch((error: Error) => error.name);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    queue.stop(); release();
    expect(await rejected).toBe('AbortError');
    await first;
    expect(queued).not.toHaveBeenCalled();
  });
});
