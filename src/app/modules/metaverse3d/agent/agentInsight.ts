import type { AgentState } from "./types";
import type { ExhibitItem } from "../types";

export type AgentInsight = {
  modeLabel: string;
  visitedCount: number;
  engagedCount: number;
  topDwellLabel: string;
  recommendationTitle: string;
};

const MODE_LABELS: Record<AgentState["mode"], string> = {
  idle: "Standing by",
  follow: "Following visitor",
  guide: "Explaining nearby exhibit",
  answer: "Answering",
  wander: "Exploring",
  tour: "Guided tour",
};

export function buildAgentInsight({
  agent,
  items,
}: {
  agent: AgentState;
  items: ExhibitItem[];
}): AgentInsight {
  const topDwell = Object.entries(agent.memory.dwellSecondsByExhibit)
    .sort((a, b) => b[1] - a[1])[0];
  const topDwellItem = topDwell ? items.find((item) => item.id === topDwell[0]) : null;
  const topDwellLabel = topDwell
    ? `${topDwellItem?.title || topDwell[0]} · ${Math.round(topDwell[1])}s`
    : "No dwell signal yet";

  return {
    modeLabel: MODE_LABELS[agent.mode] || "Standing by",
    visitedCount: agent.memory.visitedExhibitIds.length,
    engagedCount: agent.memory.engagedExhibitIds.length,
    topDwellLabel,
    recommendationTitle: agent.recommendedExhibit?.title || "No recommendation yet",
  };
}
