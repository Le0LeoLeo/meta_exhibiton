import { describe, expect, it } from "vitest";
import {
  getCeilingFixtureLayout,
  getCeilingServiceLayout,
} from "./GalleryCeiling";

describe("getCeilingFixtureLayout", () => {
  it("reduces fixture density by performance tier", () => {
    const quality = getCeilingFixtureLayout(9, 50, "quality");
    const balanced = getCeilingFixtureLayout(9, 50, "balanced");
    const performance = getCeilingFixtureLayout(9, 50, "performance");

    expect(quality.length).toBeGreaterThan(balanced.length);
    expect(balanced.length).toBeGreaterThan(performance.length);
    expect(performance).toEqual([]);
  });

  it("keeps every fixture inside the ceiling bounds", () => {
    const layout = getCeilingFixtureLayout(6, 12, "quality");

    for (const [x, z] of layout) {
      expect(Math.abs(x)).toBeLessThan(3);
      expect(Math.abs(z)).toBeLessThan(6);
    }
  });
});

describe("getCeilingServiceLayout", () => {
  it("adds sparse services by performance tier", () => {
    const quality = getCeilingServiceLayout(9, 50, "quality");
    const balanced = getCeilingServiceLayout(9, 50, "balanced");
    const performance = getCeilingServiceLayout(9, 50, "performance");

    expect(quality.vents.length).toBeGreaterThan(0);
    expect(quality.sprinklers.length).toBeGreaterThan(0);
    expect(quality.sensors.length).toBeGreaterThan(0);
    expect(quality.vents.length).toBeGreaterThan(balanced.vents.length);
    expect(quality.sprinklers.length).toBeGreaterThan(balanced.sprinklers.length);
    expect(quality.sensors.length).toBeGreaterThan(balanced.sensors.length);
    expect(performance).toEqual({ vents: [], sprinklers: [], sensors: [] });
  });

  it("is deterministic, sparse, and keeps services inside the ceiling", () => {
    const first = getCeilingServiceLayout(9, 50, "quality");
    const second = getCeilingServiceLayout(9, 50, "quality");

    expect(second).toEqual(first);
    expect(first.vents.length).toBeLessThanOrEqual(4);
    expect(first.sprinklers.length).toBeLessThanOrEqual(7);
    expect(first.sensors.length).toBeLessThanOrEqual(2);

    for (const [x, z] of [
      ...first.vents,
      ...first.sprinklers,
      ...first.sensors,
    ]) {
      expect(Math.abs(x)).toBeLessThan(4.5);
      expect(Math.abs(z)).toBeLessThan(25);
    }
  });
});
