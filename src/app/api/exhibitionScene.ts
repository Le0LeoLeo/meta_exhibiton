import type { SceneSnapshot } from "../modules/metaverse3d/store/metaverseStoreTypes";
import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";

export type ExhibitionSceneStyle =
  | "white-box"
  | "warm-museum"
  | "tech-showroom"
  | "history-gallery"
  | "immersive";

export type ExhibitionSceneRequest = {
  prompt: string;
  language?: "zh-TW" | "zh-CN" | "en";
  style?: ExhibitionSceneStyle;
  exhibitCount?: number;
  roomShape?: "single-room" | "long-gallery" | "multi-room";
  roomWidth?: number;
  roomLength?: number;
  currentScene?: SceneSnapshot | null;
  assets?: Array<{
    title?: string;
    artist?: string;
    description?: string;
    imageUrl?: string;
    type?: "image" | "text" | "model" | "video";
  }>;
};

export type ExhibitionSceneResponse = {
  exhibition: {
    title: string;
    curatorialStatement: string;
    sections: Array<{
      title: string;
      description: string;
      exhibitIds: string[];
    }>;
  };
  scene: SceneSnapshot;
  warnings: string[];
  source: "qwen" | "fallback";
};

export type BuilderScreenshot = {
  viewId: string;
  label: string;
  dataUrl: string;
};

export type BuilderReviewIssue = {
  category: "geometry" | "layout" | "lighting" | "navigation" | "curation";
  severity: "low" | "medium" | "high";
  viewId: string;
  message: string;
  suggestedFix: string;
};

export type BuilderReview = {
  technicalScore: number;
  curatorialScore: number;
  overallStatus: "pass" | "needs_revision" | "blocked";
  blockingIssues: BuilderReviewIssue[];
  viewReviews: Array<{
    viewId: string;
    label: string;
    observations: string[];
  }>;
  revisionPrompt: string;
};

export type BuilderSessionResponse = ExhibitionSceneResponse & {
  sessionId: string;
  versionId: string;
  status: "generated" | "revised";
  revisionCount?: number;
};

export type BuilderReviewResponse = {
  sessionId: string;
  versionId: string;
  review: BuilderReview;
  status: "reviewed";
};

export async function requestExhibitionScene(
  token: string,
  payload: ExhibitionSceneRequest,
): Promise<ExhibitionSceneResponse> {
  const res = await fetch(apiUrl("/api/ai/exhibition-scene"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI 建展失敗");
  return data as ExhibitionSceneResponse;
}

export async function requestBuilderSession(
  token: string,
  payload: ExhibitionSceneRequest,
): Promise<BuilderSessionResponse> {
  const res = await fetch(apiUrl("/api/ai/exhibition-builder/start"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI exhibition builder failed to start");
  return data as BuilderSessionResponse;
}

export async function requestBuilderReview(
  token: string,
  payload: {
    sessionId: string;
    versionId: string;
    scene: SceneSnapshot;
    screenshots: BuilderScreenshot[];
  },
): Promise<BuilderReviewResponse> {
  const res = await fetch(apiUrl("/api/ai/exhibition-builder/review"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI exhibition builder review failed");
  return data as BuilderReviewResponse;
}

export async function requestBuilderRevision(
  token: string,
  payload: {
    sessionId: string;
    versionId: string;
    scene: SceneSnapshot;
    review: BuilderReview;
    prompt?: string;
    revisionCount?: number;
  },
): Promise<BuilderSessionResponse> {
  const res = await fetch(apiUrl("/api/ai/exhibition-builder/revise"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI exhibition builder revision failed");
  return data as BuilderSessionResponse;
}
