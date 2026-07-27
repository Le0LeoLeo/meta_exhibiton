import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from './base';
import { apiFetch, LONG_API_TIMEOUT_MS } from './request';

export type AgentSceneExhibitPayload = {
  id: string;
  title?: string | null;
  artist?: string | null;
  description?: string | null;
  content?: string | null;
  type?: string | null;
  position?: [number, number, number] | null;
};

export type AgentChatHistoryPayload = {
  role: 'assistant' | 'user' | 'system';
  content: string;
};

export type AgentVisitorStatePayload = {
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
): Promise<{ answer: string; source: 'qwen' | 'fallback'; recommendedExhibit: AgentRecommendationPayload | null }> {
  const res = await apiFetch(apiUrl('/api/agent/reply'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, 'Agent 回答失敗');
  return data as { answer: string; source: 'qwen' | 'fallback'; recommendedExhibit: AgentRecommendationPayload | null };
}
