import { v4 as uuidv4 } from "uuid";
import type {
  AppMode,
  ExhibitItem,
  FloorPlanElement,
  FloorPlanElementType,
  RoomSize,
  WallAnchor,
  WallFace,
  WallMaterialSettings,
} from "../types";
import type { AgentChatMessage, AgentRecommendation, AgentState, AgentTourSession } from "../agent/types";

export interface SceneSnapshot {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
}

export const MAX_HISTORY = 100;

export const createDefaultAgentTourSession = (): AgentTourSession => ({
  tourRunId: null,
  status: "idle",
  routeExhibitIds: [],
  currentStopIndex: 0,
  currentExhibitId: null,
  arrivedExhibitId: null,
  lastExplainedExhibitId: null,
});

export const defaultAgentTourSession: AgentTourSession = createDefaultAgentTourSession();

export const defaultAgentState: AgentState = {
  enabled: false,
  participationMode: "solo",
  hasSelectedParticipationMode: false,
  allowPointerLock: true,
  personality: "xiaobai",
  mode: "idle",
  tourSession: createDefaultAgentTourSession(),
  position: [0, 0.15, 0],
  rotationY: 0,
  targetPosition: null,
  followUser: false,
  visibleInEdit: false,
  visibleInFloorPlan: false,
  isChatOpen: false,
  isAnswering: false,
  currentDialogue: "",
  lastQuestion: "",
  pendingQuestion: "",
  nearbyExhibitId: null,
  lastKnownExhibitId: null,
  activeExhibit: null,
  memory: {
    sessionId: uuidv4(),
    visitedExhibitIds: [],
    engagedExhibitIds: [],
    dwellSecondsByExhibit: {},
    lastRecommendedExhibitId: null,
    conversationSummary: "",
  },
  recommendedExhibit: null,
  preferredLanguage: "zh-TW",
};

export function createSnapshot(state: Pick<AppStateLike, "roomSize" | "items" | "floorPlanElements" | "wallMaterialOverrides">): SceneSnapshot {
  return structuredClone({
    roomSize: state.roomSize,
    items: state.items,
    floorPlanElements: state.floorPlanElements,
    wallMaterialOverrides: state.wallMaterialOverrides,
  });
}

export function withHistory(state: AppStateLike, patch: Partial<AppStateLike>): Partial<AppStateLike> {
  const prevSnapshot = createSnapshot(state);
  const undoStack = state.undoStack ?? [];
  return { ...patch, undoStack: [...undoStack, prevSnapshot].slice(-MAX_HISTORY), redoStack: [] };
}

export function sanitizeAssetUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("blob:")) return "";
  return url;
}

export function isLikelyColor(value: string): boolean {
  const v = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
}

export function sanitizeItemsForPersist(items: ExhibitItem[]): ExhibitItem[] {
  return items.map((item) => ({
    ...item,
    content: sanitizeAssetUrl(typeof item.content === "string" ? item.content : ""),
    externalUrl: sanitizeAssetUrl(item.externalUrl),
    videoThumbnailUrl: sanitizeAssetUrl(item.videoThumbnailUrl),
  }));
}

export function normalizeImportedItemContent(type: ExhibitItem["type"], rawContent: unknown): string {
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  if (type === "painting" || type === "pedestal" || type === "text") return content;
  if (isLikelyColor(content)) return content;
  const defaults: Record<Exclude<ExhibitItem["type"], "painting" | "pedestal" | "text">, string> = {
    partition: "#f3f4f6",
    lightstrip: "#ffe08a",
    flower: "#ec4899",
    chandelier: "#fde68a",
    bench: "#8b5e3c",
    rug: "#1d4ed8",
    vase: "#38bdf8",
    sculpture: "#9ca3af",
    spotlight: "#fff3b0",
    plant: "#22c55e",
    column: "#cbd5e1",
    neon: "#22d3ee",
  };
  return defaults[type as keyof typeof defaults] ?? "#9ca3af";
}

export function parseVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || fallback[0], Number(value[1]) || fallback[1], Number(value[2]) || fallback[2]];
  }
  if (typeof value === "string") {
    const parts = value.split(",").map((part) => Number(part.trim())).filter((n) => Number.isFinite(n));
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  if (value && typeof value === "object") {
    const obj = value as { x?: unknown; y?: unknown; z?: unknown };
    const x = Number(obj.x);
    const y = Number(obj.y);
    const z = Number(obj.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  return fallback;
}

export function parseRotationVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  const [x, y, z] = parseVec3(value, fallback);
  const toRadians = (n: number) => (Math.abs(n) > Math.PI * 2 && Math.abs(n) <= 360 ? (n * Math.PI) / 180 : n);
  return [toRadians(x), toRadians(y), toRadians(z)];
}

export function sanitizeRoomSizeForPersist(roomSize: RoomSize): RoomSize {
  return {
    ...roomSize,
    wallTextureUrl: sanitizeAssetUrl(roomSize.wallTextureUrl) || "/textures/wall-paint.svg",
    floorTextureUrl: sanitizeAssetUrl(roomSize.floorTextureUrl) || "/textures/wall-concrete.svg",
    wallTextureCustomPresets: Array.isArray(roomSize.wallTextureCustomPresets)
      ? roomSize.wallTextureCustomPresets.filter((preset) => preset && typeof preset.label === "string" && typeof preset.value === "string")
      : undefined,
  };
}

export function sanitizeWallOverridesForPersist(
  overrides: Record<string, Partial<WallMaterialSettings>> | null | undefined,
): Record<string, Partial<WallMaterialSettings>> {
  if (!overrides || typeof overrides !== "object") return {};
  return Object.fromEntries(
    Object.entries(overrides)
      .filter((entry): entry is [string, Partial<WallMaterialSettings>] => {
        const [, value] = entry;
        return !!value && typeof value === "object";
      })
      .map(([id, value]) => [
        id,
        {
          ...value,
          wallTextureUrl: value.wallTextureUrl ? sanitizeAssetUrl(value.wallTextureUrl) : value.wallTextureUrl,
        },
      ]),
  );
}

interface AppStateLike {
  roomSize: RoomSize;
  items: ExhibitItem[];
  floorPlanElements: FloorPlanElement[];
  wallMaterialOverrides: Record<string, Partial<WallMaterialSettings>>;
  undoStack?: SceneSnapshot[];
  redoStack?: SceneSnapshot[];
}

export type { AppMode, WallFace, WallAnchor, FloorPlanElementType, AgentChatMessage, AgentRecommendation, AgentState };
