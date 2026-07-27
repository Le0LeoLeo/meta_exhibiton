import type { ExhibitionPassport, ExhibitionPassportTask, PassportProgress } from "@/app/api/exhibitionPassport";

type VisitorMemory = {
  visitedExhibitIds?: string[];
  engagedExhibitIds?: string[];
  dwellSecondsByExhibit?: Record<string, number>;
};

function uniqueEligibleIds(ids: string[] | undefined, eligibleIds: Set<string>) {
  return new Set((ids ?? []).filter((id) => eligibleIds.has(id)));
}

/** Optimistic UI only. The server remains authoritative when completing a passport. */
export function calculatePassportProgress(
  tasks: ExhibitionPassportTask[],
  memory: VisitorMemory,
  eligibleExhibitIds: Iterable<string>,
): PassportProgress {
  const eligibleIds = new Set(eligibleExhibitIds);
  const visitedIds = uniqueEligibleIds(memory.visitedExhibitIds, eligibleIds);
  const engagedIds = uniqueEligibleIds(memory.engagedExhibitIds, eligibleIds);
  const longestDwellSeconds = Object.entries(memory.dwellSecondsByExhibit ?? {}).reduce(
    (longest, [id, seconds]) => {
      if (!eligibleIds.has(id) || !Number.isFinite(seconds) || seconds < 0) return longest;
      return Math.max(longest, seconds);
    },
    0,
  );

  const completedTaskIds = tasks.flatMap((task) => {
    if (task.kind === "visit-count" && visitedIds.size >= task.target) return [task.id];
    if (task.kind === "dwell-one" && longestDwellSeconds >= task.targetSeconds) return [task.id];
    if (task.kind === "engage-count" && engagedIds.size >= task.target) return [task.id];
    return [];
  });

  return {
    completedTaskIds,
    visitedCount: visitedIds.size,
    engagedCount: engagedIds.size,
    longestDwellSeconds,
    complete: tasks.length > 0 && completedTaskIds.length === tasks.length,
  };
}

export function calculatePassportProgressFromPassport(
  passport: ExhibitionPassport,
  memory: VisitorMemory,
  eligibleExhibitIds: Iterable<string>,
) {
  return calculatePassportProgress(passport.tasks, memory, eligibleExhibitIds);
}
