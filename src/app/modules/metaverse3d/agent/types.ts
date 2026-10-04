import type { ExhibitItem } from "../types";
import type { AgentSceneExhibitPayload } from '@/app/api/agent';

export type AgentPersonality = "xiaobai" | "expert" | "humor";
export type AgentMode = "idle" | "follow" | "guide" | "answer" | "wander" | "tour";
export type AgentParticipationMode = "solo" | "ai";
export type AgentAnswerSource = "local" | "remote";

export type AgentTourStatus = "idle" | "running" | "paused" | "arrived" | "complete";

export interface AgentTourSession {
  tourRunId: string | null;
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

export interface AgentCompanionState {
  proactiveEnabled: boolean;
  voiceEnabled: boolean;
  focusExhibitId: string | null;
  focusSeconds: number;
  isRevisit: boolean;
  invitation: { exhibitId: string; kind: 'notice' | 'revisit' } | null;
  promptedExhibitIds: string[];
  dismissedCount: number;
  nextPromptAt: number;
}

export interface AgentState {
  companion: AgentCompanionState;
  replySource: 'qwen' | 'fallback' | null;
  replyRequestId: string | null;
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
  answerSource: AgentAnswerSource | null;
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
  exhibit?: AgentSceneExhibitPayload | null;
  nearbyExhibits: AgentSceneExhibitPayload[];
  preferredLanguage?: string;
}
