import { apiUrl, authHeaders, errorFromResponse, parseJsonSafe } from "./base";

export interface CuratorPlanRequest {
  theme: string;
  style?: string;
  audience?: string;
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
  const res = await fetch(apiUrl("/api/ai/curator-plan"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw errorFromResponse(data, "AI curator failed");
  return data as CuratorPlanResponse;
}
