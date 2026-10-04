import type { ExhibitItem } from "../types";
import type { AgentChatHistoryPayload, AgentSceneExhibitPayload, AgentUserPreferencesPayload, AgentVisitorStatePayload } from "../../../api/agent";
import type { AgentChatMessage, AgentState } from './types';
import { getSceneExhibits, resolveVisitorFocus } from './companion';
import { normalizeWorkContext } from '../workContext';

export type AgentReplyRequest = {
  question: string;
  personality: "xiaobai" | "expert" | "humor";
  exhibitId?: string | null;
  exhibit?: AgentSceneExhibitPayload | null;
  nearbyExhibits?: AgentSceneExhibitPayload[];
  chatHistory?: AgentChatHistoryPayload[];
  visitorState?: AgentVisitorStatePayload;
  sessionState?: {
    sessionId: string;
    tourProgress?: {
      currentStopIndex?: number;
      totalStops?: number;
      currentExhibitId?: string | null;
      completedExhibitIds?: string[];
    } | null;
  } | null;
  userPreferences?: AgentUserPreferencesPayload | null;
};

export function serializeAgentExhibit(item: AgentSceneExhibitPayload): AgentSceneExhibitPayload {
  return {
    id: item.id,
    title: item.title ?? null,
    artist: item.artist ?? null,
    description: item.description ?? null,
    ...(item.workContext ? { workContext: normalizeWorkContext(item.workContext) } : {}),
    ...(item.type === 'painting' && (item.imageUrl || /^(https?:|data:image\/|blob:|\/)/i.test(item.content?.trim() ?? ''))
      ? { imageUrl: item.imageUrl || item.content!.trim() } : {}),
    // Media URLs and colour literals are not curatorial text.
    content: typeof item.content === "string" && !/^(https?:|data:|blob:|\/|#[\da-f]{3,8}$)/i.test(item.content.trim()) ? item.content : null,
    type: item.type,
    position: item.position,
  };
}

export function getAgentSceneExhibits(
  items: ExhibitItem[],
  origin?: [number, number, number],
): AgentSceneExhibitPayload[] {
  const exhibits = getSceneExhibits(items).map(serializeAgentExhibit);

  if (origin?.every(Number.isFinite)) {
    exhibits.sort((a, b) => {
      const distanceSquared = (position: AgentSceneExhibitPayload["position"]) => {
        if (!position?.every(Number.isFinite)) return Number.POSITIVE_INFINITY;
        const dx = position[0] - origin[0];
        const dz = position[2] - origin[2];
        return dx * dx + dz * dz;
      };
      return distanceSquared(a.position) - distanceSquared(b.position);
    });
  }

  return exhibits.slice(0, 8);
}

export function buildVisitorAwareRequest({ question, agent, items, position, viewingId, chat, exhibitOverride }: {
  question: string; agent: AgentState; items: ExhibitItem[]; position: [number, number, number];
  viewingId: string | null; chat: AgentChatMessage[]; exhibitOverride?: AgentSceneExhibitPayload | null;
}): AgentReplyRequest {
  const scene = getSceneExhibits(items);
  const named = scene.filter((item) => item.title && item.title.trim().length >= 2 && question.toLocaleLowerCase().includes(item.title.trim().toLocaleLowerCase()));
  const exhibit = exhibitOverride === undefined
    ? (named.length === 1 && !/比較|比较|對比|对比|compare|difference|different/i.test(question) ? named[0] : resolveVisitorFocus(items, position, viewingId))
    : exhibitOverride;
  const nearby = getAgentSceneExhibits(items, position);
  // Retain recently discussed works for follow-up comparisons, within the API budget.
  const contextualIds = [...agent.memory.engagedExhibitIds].reverse();
  const unvisited = scene.filter((item) => !agent.memory.visitedExhibitIds.includes(item.id))
    .sort((a, b) => Math.hypot(a.position[0] - position[0], a.position[2] - position[2]) - Math.hypot(b.position[0] - position[0], b.position[2] - position[2]));
  const context = [...new Map([
    ...named.slice(0, 4).map(serializeAgentExhibit),
    ...nearby,
    ...contextualIds.map((id) => scene.find((item) => item.id === id)).filter((item): item is ExhibitItem => Boolean(item)).slice(0, 6).map(serializeAgentExhibit),
    ...unvisited.slice(0, 8).map(serializeAgentExhibit),
  ].map((item) => [item.id, item])).values()].slice(0, 24);
  const tour = agent.tourSession;
  return buildAgentReplyRequest({
    question, personality: agent.personality, exhibit, nearbyExhibits: context,
    chatHistory: chat.filter((entry) => entry.role !== 'system').slice(-12).map(({ role, content }) => ({ role, content: content.slice(0, 2000) })),
    userPreferences: {
      answerLength: agent.personality === 'expert' ? 'deep' : 'short',
      guideStyle: agent.personality === 'expert' ? 'educational' : agent.personality === 'humor' ? 'story' : 'emotional',
    },
    visitorState: {
      currentPosition: position, mode: agent.mode, followUser: agent.followUser, viewingExhibitId: exhibit?.id ?? null,
      visitedExhibitIds: agent.memory.visitedExhibitIds.slice(-100), engagedExhibitIds: agent.memory.engagedExhibitIds.slice(-100),
      dwellSecondsByExhibit: agent.memory.dwellSecondsByExhibit,
      lastRecommendedExhibitId: agent.memory.lastRecommendedExhibitId, preferredLanguage: agent.preferredLanguage || 'zh-TW',
    },
    sessionState: { sessionId: agent.memory.sessionId, tourProgress: tour.routeExhibitIds.length ? {
      currentStopIndex: tour.currentStopIndex + 1, totalStops: tour.routeExhibitIds.length, currentExhibitId: tour.currentExhibitId,
      completedExhibitIds: (tour.status === 'complete' ? tour.routeExhibitIds : tour.routeExhibitIds.slice(0, tour.currentStopIndex)).slice(-100),
    } : null },
  });
}

export function buildAgentReplyRequest(params: {
  question: string;
  personality: "xiaobai" | "expert" | "humor";
  exhibit?: AgentSceneExhibitPayload | null;
  nearbyExhibits?: AgentSceneExhibitPayload[];
  chatHistory?: AgentChatHistoryPayload[];
  visitorState?: AgentVisitorStatePayload;
  sessionState?: AgentReplyRequest["sessionState"];
  userPreferences?: AgentUserPreferencesPayload | null;
}): AgentReplyRequest {
  return {
    question: params.question,
    personality: params.personality,
    exhibitId: params.exhibit?.id ?? null,
    exhibit: params.exhibit ? serializeAgentExhibit(params.exhibit) : null,
    nearbyExhibits: (params.nearbyExhibits ?? []).map(serializeAgentExhibit),
    chatHistory: params.chatHistory,
    visitorState: params.visitorState,
    sessionState: params.sessionState,
    userPreferences: params.userPreferences,
  };
}
