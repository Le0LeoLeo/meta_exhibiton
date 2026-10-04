import { describe, expect, it } from "vitest";
import { selectAvatarAnimation } from "./useAvatarAnimation";

describe("selectAvatarAnimation", () => {
  it("uses idle for a stationary avatar and walk for meaningful movement", () => {
    expect(selectAvatarAnimation(0, "none", "Idle")).toBe("Idle");
    expect(selectAvatarAnimation(0.3, "none", "Idle")).toBe("Walk");
  });

  it("uses hysteresis to avoid flickering around the walk threshold", () => {
    expect(selectAvatarAnimation(0.11, "none", "Idle")).toBe("Idle");
    expect(selectAvatarAnimation(0.11, "none", "Walk")).toBe("Walk");
    expect(selectAvatarAnimation(0.05, "none", "Walk")).toBe("Idle");
  });

  it("prioritizes emotes and handles invalid speeds", () => {
    expect(selectAvatarAnimation(1, "wave", "Walk")).toBe("Wave");
    expect(selectAvatarAnimation(1, "cheer", "Walk")).toBe("Cheer");
    expect(selectAvatarAnimation(1, "clap", "Walk")).toBe("Clap");
    expect(selectAvatarAnimation(1, "bow", "Walk")).toBe("Bow");
    expect(selectAvatarAnimation(Number.NaN, "none", "Walk")).toBe("Idle");
    expect(selectAvatarAnimation(-2, "none", "Idle")).toBe("Idle");
  });
});
