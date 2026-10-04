import type { ExhibitItem } from "../types";

/**
 * Builder warnings name exhibits by internal id so the agent can act on them.
 * For people, show each work's title instead (or its type when it has none).
 */
export function describeBuilderWarning(warning: string, items: ReadonlyArray<Pick<ExhibitItem, "id" | "title" | "type">>): string {
  const names = new Map<string, string>();
  for (const item of items) {
    if (!item.id || names.has(item.id)) continue;
    const title = item.title?.trim();
    names.set(item.id, title ? `“${title}”` : `the ${item.type}`);
  }
  if (!names.size) return warning;
  // Longest ids first, so an id that prefixes another is not replaced inside it.
  const ids = [...names.keys()].sort((a, b) => b.length - a.length).map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return warning.replace(new RegExp(`(?<![\\w-])(?:${ids.join("|")})(?![\\w-])`, "g"), (id) => names.get(id) ?? id);
}
