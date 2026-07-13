import type { AgentPersonality } from "./types";

import noobModelUrl from "../../../../../noob.glb?url";
import professionalModelUrl from "../../../../../professional.glb?url";
import funnyModelUrl from "../../../../../funny.glb?url";

export interface AgentVisualConfig {
  personality: AgentPersonality;
  label: string;
  tone: string;
  description: string;
  accent: string;
  modelUrl: string;
  scale: number;
  yOffset: number;
  rotation: [number, number, number];
}

export const AGENT_VISUALS: Record<AgentPersonality, AgentVisualConfig> = {
  xiaobai: {
    personality: "xiaobai",
    label: "小白",
    tone: "親切入門",
    description: "用簡單、溫暖的語氣介紹展品，適合第一次參觀或想快速理解重點的觀眾。",
    accent: "#7dd3fc",
    modelUrl: noobModelUrl,
    scale: 0.95,
    yOffset: 0.02,
    rotation: [Math.PI / 2, -Math.PI / 2, Math.PI / 2],
  },
  expert: {
    personality: "expert",
    label: "專家",
    tone: "深度解析",
    description: "提供背景脈絡、技法與策展觀點，適合想深入理解作品與展覽主題的觀眾。",
    accent: "#c4b5fd",
    modelUrl: professionalModelUrl,
    scale: 0.95,
    yOffset: 0.02,
    rotation: [Math.PI / 2, -Math.PI / 2, Math.PI / 2],
  },
  humor: {
    personality: "humor",
    label: "幽默",
    tone: "輕鬆有趣",
    description: "用故事感與輕鬆比喻帶路，讓展品更好親近，也讓參觀節奏更有趣。",
    accent: "#fb923c",
    modelUrl: funnyModelUrl,
    scale: 0.95,
    yOffset: 0.02,
    rotation: [Math.PI / 2, -Math.PI / 2, Math.PI / 2],
  },
};

export function getAgentVisualConfig(personality: AgentPersonality): AgentVisualConfig {
  return AGENT_VISUALS[personality] ?? AGENT_VISUALS.xiaobai;
}
