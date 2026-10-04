import type { ExhibitItem } from '../types';
import type { AgentCompanionState, AgentMemoryState, AgentState } from './types';

export const createCompanionState = (): AgentCompanionState => ({
  proactiveEnabled: true, voiceEnabled: true, focusExhibitId: null, focusSeconds: 0,
  isRevisit: false, invitation: null, promptedExhibitIds: [], dismissedCount: 0, nextPromptAt: 0,
});

export function getSceneExhibits(items: ExhibitItem[]) {
  return items.filter((item) => ['painting', 'pedestal', 'sculpture'].includes(item.type)
    && item.position?.length === 3 && item.position.every(Number.isFinite));
}

const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Explicit inspection wins; proximity is measured at the visitor, never the NPC. */
export function resolveVisitorFocus(items: ExhibitItem[], position: [number, number, number], viewingId: string | null) {
  const exhibits = getSceneExhibits(items);
  const selected = exhibits.find((item) => item.id === viewingId);
  if (selected) return selected;
  let nearest: ExhibitItem | null = null;
  let nearestDistance = 3.25;
  for (const item of exhibits) {
    const d = distance(item.position, position);
    if (d < nearestDistance) { nearest = item; nearestDistance = d; }
  }
  return nearest;
}

/** A complete, deterministic route: new works first, then distance and demonstrated interest. */
export function buildCompanionRoute(items: ExhibitItem[], memory: AgentMemoryState, position: [number, number, number]) {
  const remaining = [...getSceneExhibits(items)];
  const visited = new Set(memory.visitedExhibitIds);
  const interest = new Map<string, number>();
  for (const item of remaining) {
    interest.set(item.type, (interest.get(item.type) ?? 0) + Math.min(memory.dwellSecondsByExhibit[item.id] ?? 0, 60));
  }
  const route: string[] = [];
  let origin = position;
  while (remaining.length) {
    remaining.sort((a, b) => Number(visited.has(a.id)) - Number(visited.has(b.id))
      || (distance(origin, a.position) - Math.min((interest.get(a.type) ?? 0) / 30, 2))
        - (distance(origin, b.position) - Math.min((interest.get(b.type) ?? 0) / 30, 2))
      || a.id.localeCompare(b.id));
    const next = remaining.shift()!;
    route.push(next.id);
    origin = next.position;
  }
  return route;
}

export function observeVisitor(agent: AgentState, focus: ExhibitItem | null, elapsed: number, now: number, canInvite: boolean) {
  const previous = agent.companion;
  const sameFocus = previous.focusExhibitId === (focus?.id ?? null);
  const seconds = Number.isFinite(elapsed) ? Math.max(0, Math.min(elapsed, 2)) : 0;
  let companion: AgentCompanionState = sameFocus ? { ...previous } : {
    ...previous, focusExhibitId: focus?.id ?? null, focusSeconds: 0, invitation: null,
    isRevisit: Boolean(focus && agent.memory.visitedExhibitIds.includes(focus.id)),
  };
  if (!focus) return { memory: agent.memory, companion };
  companion.focusSeconds += seconds;
  const memory = {
    ...agent.memory,
    dwellSecondsByExhibit: { ...agent.memory.dwellSecondsByExhibit, [focus.id]: (agent.memory.dwellSecondsByExhibit[focus.id] ?? 0) + seconds },
    visitedExhibitIds: companion.focusSeconds >= 3
      ? [...new Set([...agent.memory.visitedExhibitIds, focus.id])] : agent.memory.visitedExhibitIds,
  };
  const threshold = agent.personality === 'expert' ? 12 : agent.personality === 'humor' ? 10 : 8;
  if (canInvite && companion.proactiveEnabled && !companion.invitation && now >= companion.nextPromptAt
    && companion.focusSeconds >= threshold && !companion.promptedExhibitIds.includes(focus.id)) {
    companion = { ...companion,
      invitation: { exhibitId: focus.id, kind: companion.isRevisit ? 'revisit' : 'notice' },
      promptedExhibitIds: [...companion.promptedExhibitIds, focus.id], nextPromptAt: now + 45000,
    };
  }
  return { memory, companion };
}

export function dismissCompanionInvitation(companion: AgentCompanionState, now = Date.now()): AgentCompanionState {
  return { ...companion, invitation: null, dismissedCount: companion.dismissedCount + 1,
    nextPromptAt: now + Math.min(120000 * (companion.dismissedCount + 1), 600000) };
}

/** Explicit, reversible interaction commands; ambiguous art questions remain model questions. */
export function parseCompanionCommand(question: string): 'quiet' | 'resume' | 'tour' | 'next' | null {
  const text = question.trim().replace(/[。！!？?．.]+$/, '').toLowerCase();
  if (/^(?:請|请)?(?:安靜(?:一下|陪伴)?|安静(?:一下|陪伴)?|先讓我(?:自己)?看看|先让我(?:自己)?看看|不要主動(?:介紹|說話)|不要主动(?:介绍|说话))$/.test(text)
    || /^(?:please )?(?:be quiet|quiet mode|let me look(?: first)?)(?: please)?$/.test(text)) return 'quiet';
  if (/^(?:請|请)?(?:恢復主動提示|恢复主动提示|繼續陪我看展|继续陪我看展)$/.test(text)
    || /^(?:please )?resume suggestions$/.test(text)) return 'resume';
  if (/^(?:請|请)?(?:開始導覽|开始导览|帶我逛展覽|带我逛展览)$/.test(text)
    || /^(?:please )?(?:start (?:a |the )?(?:guided )?tour|show me around)$/.test(text)) return 'tour';
  if (/^(?:請|请)?(?:下一站|帶我去下一站|带我去下一站)$/.test(text)
    || /^(?:please )?(?:next stop|take me to the next stop)$/.test(text)) return 'next';
  return null;
}
