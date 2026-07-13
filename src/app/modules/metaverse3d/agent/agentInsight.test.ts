import { describe, expect, it } from "vitest";
import { buildAgentInsight } from "./agentInsight";
import { defaultAgentState } from "../store/metaverseStoreUtils";
import type { ExhibitItem } from "../types";

const items: ExhibitItem[] = [
  {
    id: "e1",
    type: "painting",
    title: "Morning Light",
    artist: "Student A",
    description: "",
    content: "",
    position: [0, 0.15, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  {
    id: "e2",
    type: "sculpture",
    title: "Stone Memory",
    artist: "Student B",
    description: "",
    content: "",
    position: [2, 0.15, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
];

describe("buildAgentInsight", () => {
  it("summarizes memory, mode, dwell-time, and recommendation signals", () => {
    const insight = buildAgentInsight({
      agent: {
        ...defaultAgentState,
        mode: "tour",
        recommendedExhibit: {
          id: "e2",
          title: "Stone Memory",
          reason: "same type as the current exhibit",
        },
        memory: {
          ...defaultAgentState.memory,
          visitedExhibitIds: ["e1"],
          engagedExhibitIds: ["e1", "e2"],
          dwellSecondsByExhibit: {
            e1: 12,
            e2: 41,
          },
        },
      },
      items,
    });

    expect(insight).toEqual({
      modeLabel: "Guided tour",
      visitedCount: 1,
      engagedCount: 2,
      topDwellLabel: "Stone Memory · 41s",
      recommendationTitle: "Stone Memory",
    });
  });

  it("uses stable empty-state labels when no memory exists", () => {
    const insight = buildAgentInsight({
      agent: defaultAgentState,
      items,
    });

    expect(insight.topDwellLabel).toBe("No dwell signal yet");
    expect(insight.recommendationTitle).toBe("No recommendation yet");
  });
});
