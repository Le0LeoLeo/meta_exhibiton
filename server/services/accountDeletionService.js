async function processFileCleanupJobs({
  jobs,
  deleteGrowthAssetFiles,
  deleteMediaFiles,
  markFileCleanupJobCompleted,
  markFileCleanupJobFailed,
  logger = console,
}) {
  let cleanupPending = false;

  for (const job of jobs) {
    try {
      if (job.kind === 'growth') await deleteGrowthAssetFiles([job.target]);
      else await deleteMediaFiles([job.target]);
      await markFileCleanupJobCompleted(job.id);
    } catch (error) {
      cleanupPending = true;
      logger.error('[auth] deferred account file cleanup', error);
      await markFileCleanupJobFailed(job.id, error instanceof Error ? error.message : 'cleanup failed');
    }
  }

  return { cleanupPending, cleanupJobs: jobs.length };
}

export async function deleteAccountWithCleanup({
  ownerId,
  growthAssetUrls,
  mediaFileNames,
  deleteUserAndCreateFileCleanupJobs,
  ...cleanupDependencies
}) {
  const requestedJobs = [
    ...(growthAssetUrls || []).map((target) => ({ kind: 'growth', target })),
    ...(mediaFileNames || []).map((target) => ({ kind: 'media', target })),
  ];
  const jobs = await deleteUserAndCreateFileCleanupJobs(ownerId, requestedJobs);
  return processFileCleanupJobs({ jobs, ...cleanupDependencies });
}

export async function retryPendingFileCleanupJobs({
  listRetryableFileCleanupJobs,
  ...cleanupDependencies
}) {
  const jobs = await listRetryableFileCleanupJobs();
  return processFileCleanupJobs({ jobs, ...cleanupDependencies });
}
