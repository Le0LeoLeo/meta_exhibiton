import { describe, expect, it } from "vitest";

import type { BuilderAgentStep } from "./runExhibitionBuilderAgent";
import { summarizeBuilderAgentRun } from "./summarizeBuilderAgentRun";

describe("summarizeBuilderAgentRun", () => {
  it("summarizes score movement and completed work", () => {
    const steps: BuilderAgentStep[] = [
      { phase: "capturing", attempt: 0, maxRevisions: 2 },
      { phase: "reviewing", attempt: 0, maxRevisions: 2 },
      {
        phase: "revising",
        attempt: 1,
        maxRevisions: 2,
        scores: { technical: 60, curatorial: 70 },
      },
      { phase: "capturing", attempt: 1, maxRevisions: 2 },
      { phase: "reviewing", attempt: 1, maxRevisions: 2 },
      {
        phase: "completed",
        attempt: 1,
        maxRevisions: 2,
        scores: { technical: 72, curatorial: 75 },
      },
    ];

    expect(summarizeBuilderAgentRun(steps)).toEqual({
      reviewCount: 2,
      revisionCount: 1,
      initialScores: { technical: 60, curatorial: 70 },
      latestScores: { technical: 72, curatorial: 75 },
      technicalDelta: 12,
      curatorialDelta: 5,
    });
  });

  it("returns null before a scored review is available", () => {
    expect(summarizeBuilderAgentRun([
      { phase: "generating", attempt: 0, maxRevisions: 3 },
      { phase: "capturing", attempt: 0, maxRevisions: 3 },
    ])).toBeNull();
  });
});
