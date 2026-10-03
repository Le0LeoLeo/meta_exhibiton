import type { AgentPersonality } from "./types";


export interface AgentVisualConfig {
  personality: AgentPersonality;
  accent: string;
}

export const AGENT_VISUALS: Record<AgentPersonality, AgentVisualConfig> = {
  xiaobai: {
    personality: "xiaobai",
    accent: "#7dd3fc",
  },
  expert: {
    personality: "expert",
    accent: "#c4b5fd",
  },
  humor: {
    personality: "humor",
    accent: "#fb923c",
  },
};

export function getAgentVisualConfig(personality: AgentPersonality): AgentVisualConfig {
  return AGENT_VISUALS[personality] ?? AGENT_VISUALS.xiaobai;
}
