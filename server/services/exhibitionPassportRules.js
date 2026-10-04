export const PASSPORT_ELIGIBLE_TYPES = new Set(['painting', 'pedestal', 'text']);

export function getEligibleExhibits(scene) {
  if (!Array.isArray(scene?.items)) return [];

  return scene.items
    .filter((item) => item && PASSPORT_ELIGIBLE_TYPES.has(item.type))
    .map((item) => ({ ...item, id: typeof item.id === 'string' ? item.id.trim() : '' }))
    .filter((item) => item.id);
}

export function buildPassportTasks({ eligibleExhibitCount }) {
  const count = Number.isFinite(eligibleExhibitCount)
    ? Math.max(0, Math.floor(eligibleExhibitCount))
    : 0;

  if (count === 0) return { available: false, tasks: [] };

  return {
    available: true,
    tasks: [
      { id: 'visit-count', kind: 'visit-count', target: Math.min(3, count) },
      { id: 'dwell-one', kind: 'dwell-one', targetSeconds: 20 },
      { id: 'engage-count', kind: 'engage-count', target: 1 },
    ],
  };
}

export function evaluatePassportProgress(tasks, memory, eligibleExhibitIds) {
  const eligible = new Set(eligibleExhibitIds || []);
  const uniqueEligibleIds = (values) => new Set(
    (Array.isArray(values) ? values : []).filter((id) => eligible.has(id)),
  );
  const visitedCount = uniqueEligibleIds(memory?.visitedExhibitIds).size;
  const engagedCount = uniqueEligibleIds(memory?.engagedExhibitIds).size;
  const dwellValues = Object.entries(memory?.dwellSecondsByExhibit || {})
    .filter(([id]) => eligible.has(id))
    .map(([, value]) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const longestDwellSeconds = dwellValues.length ? Math.max(...dwellValues) : 0;
  const completedTaskIds = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => {
      if (task?.kind === 'visit-count') return visitedCount >= task.target;
      if (task?.kind === 'dwell-one') return longestDwellSeconds >= task.targetSeconds;
      if (task?.kind === 'engage-count') return engagedCount >= task.target;
      return false;
    })
    .map((task) => task.id);

  return {
    completedTaskIds,
    visitedCount,
    engagedCount,
    longestDwellSeconds,
    complete: Array.isArray(tasks) && tasks.length > 0 && completedTaskIds.length === tasks.length,
  };
}
