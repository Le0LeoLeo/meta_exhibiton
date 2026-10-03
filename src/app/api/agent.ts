import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';
import { prepareAgentImage } from './agentImage';
import type { ExhibitWorkContext } from '../modules/metaverse3d/types';

export type AgentSceneExhibitPayload = {
  imageUrl?: string | null;
  id: string;
  title?: string | null;
  artist?: string | null;
  description?: string | null;
  workContext?: ExhibitWorkContext;
  content?: string | null;
  type?: string | null;
  position?: [number, number, number] | null;
};

export type AgentChatHistoryPayload = {
  role: 'assistant' | 'user' | 'system';
  content: string;
};

export type AgentVisitorStatePayload = {
  lastRecommendedExhibitId?: string | null;
  preferredLanguage?: string;
  currentPosition?: [number, number, number] | null;
  currentRoomId?: string | null;
  mode?: 'idle' | 'follow' | 'guide' | 'tour' | 'answer' | 'wander' | null;
  followUser?: boolean;
  viewingExhibitId?: string | null;
  visitedExhibitIds?: string[];
  engagedExhibitIds?: string[];
  dwellSecondsByExhibit?: Record<string, number>;
};

export type AgentSessionStatePayload = {
  sessionId: string;
  tourProgress?: {
    currentStopIndex?: number;
    totalStops?: number;
    currentExhibitId?: string | null;
    completedExhibitIds?: string[];
  } | null;
};

export type AgentUserPreferencesPayload = {
  answerLength?: 'short' | 'medium' | 'deep';
  guideStyle?: 'story' | 'educational' | 'emotional';
};

export type AgentRecommendationPayload = {
  id: string;
  title: string;
  reason: string;
};

export async function requestAgentReply(
  token: string,
  payload: {
    question: string;
    personality: 'xiaobai' | 'expert' | 'humor';
    exhibitId?: string | null;
    exhibit?: AgentSceneExhibitPayload | null;
    nearbyExhibits?: AgentSceneExhibitPayload[];
    chatHistory?: AgentChatHistoryPayload[];
    visitorState?: AgentVisitorStatePayload;
    sessionState?: AgentSessionStatePayload | null;
    userPreferences?: AgentUserPreferencesPayload | null;
  },
  options?: { signal?: AbortSignal },
): Promise<{ answer: string; source: 'qwen' | 'fallback'; recommendedExhibit: AgentRecommendationPayload | null }> {
  let exhibitImage: string | undefined;
  let imageUnavailable = false;
  if (payload.exhibit?.imageUrl) {
    try { exhibitImage = await prepareAgentImage(payload.exhibit.imageUrl, token, options?.signal); }
    catch (error) {
      if (options?.signal?.aborted) throw error;
      imageUnavailable = true;
    }
  }
  const withoutImageUrl = (item: AgentSceneExhibitPayload) => {
    const copy = { ...item };
    delete copy.imageUrl;
    return copy;
  };
  const res = await apiFetch(apiUrl('/api/agent/reply'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...payload,
      exhibit: payload.exhibit ? withoutImageUrl(payload.exhibit) : payload.exhibit,
      nearbyExhibits: payload.nearbyExhibits?.map(withoutImageUrl),
      ...(exhibitImage ? { exhibitImage } : {}), ...(imageUnavailable ? { imageUnavailable: true } : {}),
    }),
    signal: options?.signal,
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Agent 回答失敗');
  return data as { answer: string; source: 'qwen' | 'fallback'; recommendedExhibit: AgentRecommendationPayload | null };
}
