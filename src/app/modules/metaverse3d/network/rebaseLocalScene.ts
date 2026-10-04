import type { SceneSnapshot } from "./protocol";

function mergeChangedFields<T extends object>(base: T, local: T, remote: T): T {
  const merged = { ...remote };
  const keys = new Set([...Object.keys(base), ...Object.keys(local)]) as Set<keyof T>;
  for (const key of keys) {
    if (JSON.stringify(base[key]) === JSON.stringify(local[key])) continue;
    if (Object.hasOwn(local, key)) merged[key] = local[key];
    else delete merged[key];
  }
  return merged;
}

function mergeItems<T extends { id: string }>(base: T[], local: T[], remote: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteIds = new Set(remote.map((item) => item.id));
  const merged: T[] = [];
  for (const item of remote) {
    const previous = baseById.get(item.id);
    const current = localById.get(item.id);
    // A local deletion stays deleted. A remote deletion is never resurrected.
    if (previous && !current) continue;
    merged.push(previous && current ? mergeChangedFields(previous, current, item)
      : current ? { ...item, ...current } : item);
  }
  for (const item of local) {
    if (!baseById.has(item.id) && !remoteIds.has(item.id)) merged.push(item);
  }
  return merged;
}

// Reapply only edits made since the last transmitted baseline. Keep the remote
// baseline separate so the next send still sees these unsent changes.
export function rebaseLocalScene(
  base: SceneSnapshot,
  local: SceneSnapshot,
  remote: SceneSnapshot,
): SceneSnapshot {
  return {
    roomSize: mergeChangedFields(base.roomSize, local.roomSize, remote.roomSize),
    items: mergeItems(base.items, local.items, remote.items),
    floorPlanElements: mergeItems(base.floorPlanElements ?? [], local.floorPlanElements ?? [], remote.floorPlanElements ?? []),
    wallMaterialOverrides: mergeChangedFields(
      base.wallMaterialOverrides ?? {}, local.wallMaterialOverrides ?? {}, remote.wallMaterialOverrides ?? {},
    ),
  };
}
