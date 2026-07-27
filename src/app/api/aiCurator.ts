import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";
import { apiFetch, LONG_API_TIMEOUT_MS } from "./request";

export type CuratorIntent = "warm-memory" | "professional-gallery" | "competition-showcase";

export interface CuratorPlanRequest {
  theme: string;
  style?: string;
  audience?: string;
  intent?: CuratorIntent;
  language: "zh-TW" | "zh-CN" | "en";
  exhibitCount: number;
}

export interface CuratorPlanResponse {
  source: "qwen" | "fallback";
  exhibition: {
    title: string;
    introduction: string;
    guideOpening: string;
    sections: Array<{
      id: string;
      title: string;
      summary: string;
    }>;
    exhibits: Array<{
      id: string;
      sectionId: string;
      title: string;
      description: string;
      medium: "image" | "text" | "model" | "video" | "mixed";
      placementHint: "left-wall" | "right-wall" | "back-wall" | "center";
    }>;
  };
  warnings: string[];
}

export async function requestCuratorPlan(
  token: string,
  payload: CuratorPlanRequest,
): Promise<CuratorPlanResponse> {
  const res = await apiFetch(apiUrl("/api/ai/curator-plan"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  }, { timeoutMs: LONG_API_TIMEOUT_MS });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI curator failed");
  return data as CuratorPlanResponse;
}
