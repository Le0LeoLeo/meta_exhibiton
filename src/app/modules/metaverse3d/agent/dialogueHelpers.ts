import type { Dispatch, SetStateAction } from "react";
import type { AgentRecommendation } from "./types";
import { speakGuide } from "./movementHelpers";

export function applyFallbackDialogue(params: {
  answer: string;
  personality: "xiaobai" | "expert" | "humor";
  setAgentDialogue: (content: string) => void;
  setAgentRecommendedExhibit: (recommendation: AgentRecommendation | null) => void;
  onNext?: () => void;
}) {
  params.setAgentDialogue(params.answer);
  params.setAgentRecommendedExhibit(null);
  speakGuide(params.answer, params.personality);
  params.onNext?.();
}

export function applyAutoGuideDialogue(params: {
  answer: string;
  personality: "xiaobai" | "expert" | "humor";
  recommendedExhibit: AgentRecommendation | null;
  setAgentDialogue: (content: string) => void;
  setAgentRecommendedExhibit: (recommendation: AgentRecommendation | null) => void;
  onNext?: () => void;
}) {
  params.setAgentDialogue(params.answer);
  params.setAgentRecommendedExhibit(params.recommendedExhibit);
  speakGuide(params.answer, params.personality);
  params.onNext?.();
}
