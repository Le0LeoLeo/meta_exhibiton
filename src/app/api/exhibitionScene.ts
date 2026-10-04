import type { SceneSnapshot } from "../modules/metaverse3d/store/metaverseStoreTypes";
import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";
import { apiFetch, LONG_API_TIMEOUT_MS } from "./request";

// A builder plan may include one bounded correction call; image checks also
// process multiple room views before calling the provider.
const BUILDER_API_TIMEOUT_MS = 120_000;

export type ExhibitionSceneStyle =
  | "white-box"
  | "warm-museum"
  | "tech-showroom"
  | "history-gallery"
  | "immersive";

export type ExhibitionSceneRequest = {
  editMode?: 'complete';
  allowDestructive?: boolean;
  editorAssets?: BuilderAsset[];
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

export type BuilderAsset = { key: string; label: string; kind: 'image' | 'video' | 'model'; url: string; assetId?: string; mimeType?: string; previewUrl?: string };

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
  resolution?: "automatic" | "manual";
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
  operationSummary?: string;
  appliedOperationCount?: number;
  revisionCount: number;
  restoredFromVersionId?: string;
};

export type BuilderProviderSource = "qwen" | "fallback";
export type BuilderReviewStatus = "reviewed" | "unavailable";

export type BuilderReviewResponse = {
  sessionId: string;
  versionId: string;
  review: BuilderReview | null;
  status: BuilderReviewStatus;
  source: BuilderProviderSource;
  errorCode?: "VISION_PROVIDER_FAILED" | "INVALID_VISION_RESPONSE" | "INVALID_INSPECTION_VIEWS";
  message?: string;
};

export type BuilderSessionVersion = BuilderSessionResponse & {
  review?: BuilderReview | null;
  reviewSource?: BuilderProviderSource | null;
  reviewStatus?: BuilderReviewStatus;
  reviewMessage?: string | null;
  reviewErrorCode?: BuilderReviewResponse["errorCode"] | null;
};

export type BuilderSessionRestoreResponse = BuilderSessionResponse & {
  input: ExhibitionSceneRequest;
  versions: BuilderSessionVersion[];
  review?: BuilderReview | null;
  reviewSource?: BuilderProviderSource | null;
  reviewStatus?: BuilderReviewStatus;
  reviewMessage?: string | null;
  reviewErrorCode?: BuilderReviewResponse["errorCode"] | null;
  createdAt: string;
  updatedAt: string;
};

export class BuilderApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BuilderApiError";
  }
}

function builderErrorFromResponse(res: Response, data: unknown, fallback: string) {
  const error = errorFromResponse(data, fallback);
  return new BuilderApiError(error.message, res.status, { cause: error });
}

export async function requestExhibitionScene(
  token: string,
  payload: ExhibitionSceneRequest,
): Promise<ExhibitionSceneResponse> {
  const res = await apiFetch(apiUrl("/api/ai/exhibition-scene"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI 建展失敗");
  return data as ExhibitionSceneResponse;
}

export async function requestBuilderSession(
  token: string,
  payload: ExhibitionSceneRequest,
  signal?: AbortSignal,
): Promise<BuilderSessionResponse> {
  const res = await apiFetch(apiUrl("/api/ai/exhibition-builder/start"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
    signal,
  }, { timeoutMs: BUILDER_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw builderErrorFromResponse(res, data, "AI exhibition builder failed to start");
  return data as BuilderSessionResponse;
}

export async function requestBuilderSessionById(
  token: string,
  sessionId: string,
): Promise<BuilderSessionRestoreResponse> {
  const res = await apiFetch(apiUrl(`/api/ai/exhibition-builder/sessions/${encodeURIComponent(sessionId)}`), {
    method: "GET",
    headers: authHeaders(token),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw builderErrorFromResponse(res, data, "AI exhibition builder session failed to load");
  return data as BuilderSessionRestoreResponse;
}

export async function requestBuilderVersionRestore(
  token: string,
  payload: {
    sessionId: string;
    expectedVersionId: string;
    targetVersionId: string;
  },
): Promise<BuilderSessionRestoreResponse> {
  const res = await apiFetch(
    apiUrl(`/api/ai/exhibition-builder/sessions/${encodeURIComponent(payload.sessionId)}/restore`),
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        expectedVersionId: payload.expectedVersionId,
        targetVersionId: payload.targetVersionId,
      }),
    },
    { timeoutMs: LONG_API_TIMEOUT_MS },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) throw builderErrorFromResponse(res, data, "AI exhibition builder version failed to restore");
  return data as BuilderSessionRestoreResponse;
}

export async function requestBuilderReview(
  token: string,
  payload: {
    sessionId: string;
    versionId: string;
    scene: SceneSnapshot;
    screenshots: BuilderScreenshot[];
  },
  signal?: AbortSignal,
): Promise<BuilderReviewResponse> {
  const res = await apiFetch(apiUrl("/api/ai/exhibition-builder/review"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
    signal,
  }, { timeoutMs: BUILDER_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw builderErrorFromResponse(res, data, "AI exhibition builder review failed");
  return data as BuilderReviewResponse;
}

export async function requestBuilderRevision(
  token: string,
  payload: {
    sessionId: string;
    versionId: string;
    scene: SceneSnapshot;
    review?: BuilderReview | null;
    input?: ExhibitionSceneRequest;
    prompt?: string;
    revisionCount?: number;
  },
  signal?: AbortSignal,
): Promise<BuilderSessionResponse> {
  const res = await apiFetch(apiUrl("/api/ai/exhibition-builder/revise"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
    signal,
  }, { timeoutMs: BUILDER_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw builderErrorFromResponse(res, data, "AI exhibition builder revision failed");
  return data as BuilderSessionResponse;
}
