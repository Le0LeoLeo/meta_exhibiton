import type { ExhibitItem } from "../types";

export type AgentPersonality = "xiaobai" | "expert" | "humor";
export type AgentMode = "idle" | "follow" | "guide" | "answer" | "wander" | "tour";
export type AgentParticipationMode = "solo" | "ai";

export type AgentTourStatus = "idle" | "running" | "paused" | "arrived" | "complete";

export interface AgentTourSession {
  status: AgentTourStatus;
  routeExhibitIds: string[];
  currentStopIndex: number;
  currentExhibitId: string | null;
  arrivedExhibitId: string | null;
  lastExplainedExhibitId: string | null;
}

export interface AgentChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  createdAt: number;
}

export interface AgentRecommendation {
  id: string;
  title: string;
  reason: string;
}

export interface AgentMemoryState {
  sessionId: string;
  visitedExhibitIds: string[];
  engagedExhibitIds: string[];
  dwellSecondsByExhibit: Record<string, number>;
  lastRecommendedExhibitId: string | null;
  conversationSummary: string;
}

export interface AgentState {
  enabled: boolean;
  participationMode: AgentParticipationMode;
  hasSelectedParticipationMode?: boolean;
  allowPointerLock?: boolean;
  personality: AgentPersonality;
  mode: AgentMode;
  tourSession: AgentTourSession;
  position: [number, number, number];
  rotationY: number;
  targetPosition: [number, number, number] | null;
  followUser: boolean;
  visibleInEdit: boolean;
  visibleInFloorPlan: boolean;
  isChatOpen: boolean;
  isAnswering: boolean;
  currentDialogue: string;
  lastQuestion: string;
  pendingQuestion: string;
  nearbyExhibitId: string | null;
  lastKnownExhibitId: string | null;
  activeExhibit: ExhibitItem | null;
  memory: AgentMemoryState;
  recommendedExhibit: AgentRecommendation | null;
  preferredLanguage?: string;
}

export interface AgentResponseContext {
  question: string;
  personality: AgentPersonality;
  exhibit?: Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position"> | null;
  nearbyExhibits: Array<Pick<ExhibitItem, "id" | "title" | "artist" | "description" | "content" | "type" | "position">>;
}
