import { describe, expect, it, vi } from 'vitest';
import {
  deleteAccountWithCleanup,
  retryPendingFileCleanupJobs,
} from './accountDeletionService.js';

function dependencies(overrides = {}) {
  return {
    ownerId: 'user-1',
    growthAssetUrls: ['/uploads/growth/one.png'],
    mediaFileNames: ['00000000-0000-4000-8000-000000000001.jpg'],
    deleteUserAndCreateFileCleanupJobs: vi.fn().mockResolvedValue([
      { id: 'job-growth', kind: 'growth', target: '/uploads/growth/one.png' },
      { id: 'job-media', kind: 'media', target: '00000000-0000-4000-8000-000000000001.jpg' },
    ]),
    deleteGrowthAssetFiles: vi.fn().mockResolvedValue(undefined),
    deleteMediaFiles: vi.fn().mockResolvedValue(undefined),
    markFileCleanupJobCompleted: vi.fn().mockResolvedValue(undefined),
    markFileCleanupJobFailed: vi.fn().mockResolvedValue(undefined),
    logger: { error: vi.fn() },
    ...overrides,
  };
}

describe('deleteAccountWithCleanup', () => {
  it('records cleanup targets before deleting files and completes every job', async () => {
    const deps = dependencies();

    await expect(deleteAccountWithCleanup(deps)).resolves.toEqual({
      cleanupPending: false,
      cleanupJobs: 2,
    });
    expect(deps.deleteUserAndCreateFileCleanupJobs).toHaveBeenCalledWith('user-1', [
      { kind: 'growth', target: '/uploads/growth/one.png' },
      { kind: 'media', target: '00000000-0000-4000-8000-000000000001.jpg' },
    ]);
    expect(deps.markFileCleanupJobCompleted).toHaveBeenCalledTimes(2);
    expect(deps.markFileCleanupJobFailed).not.toHaveBeenCalled();
  });

  it('retains a failed cleanup job for retry and continues with later files', async () => {
    const deps = dependencies({
      deleteGrowthAssetFiles: vi.fn().mockRejectedValue(new Error('disk unavailable')),
    });

    await expect(deleteAccountWithCleanup(deps)).resolves.toEqual({
      cleanupPending: true,
      cleanupJobs: 2,
    });
    expect(deps.markFileCleanupJobFailed).toHaveBeenCalledWith('job-growth', 'disk unavailable');
    expect(deps.deleteMediaFiles).toHaveBeenCalledOnce();
    expect(deps.markFileCleanupJobCompleted).toHaveBeenCalledWith('job-media');
  });
});

describe('retryPendingFileCleanupJobs', () => {
  it('replays durable jobs and treats already-missing files as successful', async () => {
    const deps = dependencies({
      listRetryableFileCleanupJobs: vi.fn().mockResolvedValue([
        { id: 'retry-media', kind: 'media', target: '00000000-0000-4000-8000-000000000001.jpg' },
      ]),
    });

    await expect(retryPendingFileCleanupJobs(deps)).resolves.toEqual({
      cleanupPending: false,
      cleanupJobs: 1,
    });
    expect(deps.deleteMediaFiles).toHaveBeenCalledWith([
      '00000000-0000-4000-8000-000000000001.jpg',
    ]);
    expect(deps.markFileCleanupJobCompleted).toHaveBeenCalledWith('retry-media');
  });
});
