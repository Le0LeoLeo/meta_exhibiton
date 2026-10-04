import { describe, expect, it } from "vitest";

import type { ExhibitionPassportTask } from "@/app/api/exhibitionPassport";
import { calculatePassportProgress } from "./passportProgress";

const tasks: ExhibitionPassportTask[] = [
  { id: "visit-count", kind: "visit-count", target: 3 },
  { id: "dwell-one", kind: "dwell-one", targetSeconds: 20 },
  { id: "engage-count", kind: "engage-count", target: 1 },
];

describe("calculatePassportProgress", () => {
  it("mirrors the complete server rule fixture", () => {
    expect(calculatePassportProgress(tasks, {
      visitedExhibitIds: ["a", "b", "a", "c", "unknown"],
      engagedExhibitIds: ["c", "c", "unknown"],
      dwellSecondsByExhibit: { a: 4, b: 24, unknown: 99, c: Number.NaN },
    }, ["a", "b", "c"])).toEqual({
      completedTaskIds: ["visit-count", "dwell-one", "engage-count"],
      visitedCount: 3,
      engagedCount: 1,
      longestDwellSeconds: 24,
      complete: true,
    });
  });

  it("accepts the exact dwell boundary and ignores negative values", () => {
    expect(calculatePassportProgress(tasks, {
      visitedExhibitIds: ["a"],
      engagedExhibitIds: [],
      dwellSecondsByExhibit: { a: 20, b: -2 },
    }, ["a", "b"])).toEqual({
      completedTaskIds: ["dwell-one"],
      visitedCount: 1,
      engagedCount: 0,
      longestDwellSeconds: 20,
      complete: false,
    });
  });
});
