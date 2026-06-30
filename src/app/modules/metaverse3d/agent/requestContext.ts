import type { ExhibitItem } from "../types";
import type { AgentChatHistoryPayload, AgentSceneExhibitPayload, AgentUserPreferencesPayload, AgentVisitorStatePayload } from "../../../api/agent";

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

export function serializeAgentExhibit(item: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position">): AgentSceneExhibitPayload {
  return {
    id: item.id,
    title: item.title ?? null,
    artist: item.artist ?? null,
    description: item.description ?? null,
    content: typeof item.content === "string" ? item.content : null,
    type: item.type,
    position: item.position,
  };
}

export function getAgentSceneExhibits(items: ExhibitItem[]): AgentSceneExhibitPayload[] {
  return items
    .filter((item) => item.type === "painting" || item.type === "pedestal" || item.type === "sculpture")
    .map(serializeAgentExhibit)
    .slice(0, 8);
}

export function buildAgentReplyRequest(params: {
  question: string;
  personality: "xiaobai" | "expert" | "humor";
  exhibit?: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position"> | null;
  nearbyExhibits?: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position">[];
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
