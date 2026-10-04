import { describe, expect, it } from "vitest";
import {
  getRemoteAppearanceKey,
  getRemoteAvatarPalette,
  getRemotePlayerTransform,
  updateRemoteAvatarMotion,
} from "./remotePlayerAppearance";
import { DEFAULT_AVATAR_APPEARANCE } from "../../avatar/avatarAppearance";
import { getAvatarEyeHeight } from "../../avatar/avatarEyeHeight";

describe("remote player appearance", () => {
  it("assigns a stable palette from the player seed", () => {
    expect(getRemoteAvatarPalette("Curator")).toEqual(
      getRemoteAvatarPalette("curator"),
    );
    expect(getRemoteAvatarPalette("Curator")).toBe(
      getRemoteAvatarPalette("Curator"),
    );
  });

  it("uses saved appearance colors for the procedural fallback", () => {
    const palette = getRemoteAvatarPalette("visitor", {
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: {
        skin: "skin04",
        hair: "hairRed",
        top: "violet",
        bottom: "brown",
        shoes: "white",
      },
    });

    expect(palette).toMatchObject({
      skin: "#936044",
      hair: "#9a422f",
      jacket: "#7862a6",
      trousers: "#60483c",
      shoes: "#e8e6df",
    });
  });

  it("keeps the idle pose still", () => {
    const pose = { armSwing: 1, legSwing: 1, bob: 1, lean: 1 };

    const result = updateRemoteAvatarMotion(pose, 1.25, 0);

    expect(result).toBe(pose);
    expect(result).toEqual({
      armSwing: 0,
      legSwing: 0,
      bob: 0,
      lean: 0,
    });
  });

  it("bounds the walking pose at high network speeds", () => {
    const pose = updateRemoteAvatarMotion(
      { armSwing: 0, legSwing: 0, bob: 0, lean: 0 },
      0.2,
      50,
    );

    expect(Math.abs(pose.armSwing)).toBeLessThanOrEqual(0.58);
    expect(Math.abs(pose.legSwing)).toBeLessThanOrEqual(0.58 * 0.78);
    expect(pose.bob).toBeLessThanOrEqual(0.028);
    expect(pose.lean).toBe(-0.07);
  });

  it("smoothly blends into a still sitting pose", () => {
    const pose = updateRemoteAvatarMotion(
      {
        armSwing: 1,
        legSwing: 1,
        bob: 1,
        lean: 1,
        sittingBlend: 0,
      },
      0.2,
      2,
      true,
      1 / 30,
    );

    expect(pose.armSwing).toBe(0);
    expect(pose.legSwing).toBe(0);
    expect(pose.bob).toBe(0);
    expect(pose.sittingBlend).toBeGreaterThan(0);
    expect(pose.sittingBlend).toBeLessThan(1);
  });

  it.each([-3, Number.NaN])("treats invalid speed %s as idle", (speed) => {
    const pose = updateRemoteAvatarMotion(
      { armSwing: 1, legSwing: 1, bob: 1, lean: 1 },
      0.2,
      speed,
    );

    expect(pose).toEqual({
      armSwing: 0,
      legSwing: 0,
      bob: 0,
      lean: 0,
    });
  });

  it("converts eye-origin network coordinates to a feet-origin model transform", () => {
    const eyeHeight = getAvatarEyeHeight(DEFAULT_AVATAR_APPEARANCE);
    const transform = getRemotePlayerTransform({
      renderPosition: { x: 3, y: eyeHeight + 0.4, z: -5 },
      renderYaw: Math.PI / 3,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    });

    expect(transform.position[0]).toBe(3);
    expect(transform.position[1]).toBeCloseTo(0.4);
    expect(transform.position[2]).toBe(-5);
    expect(transform.rotation).toEqual([0, Math.PI / 3 + Math.PI, 0]);
  });

  it("rotates the model 180 degrees from the camera yaw", () => {
    const transform = getRemotePlayerTransform({
      renderPosition: {
        x: 0,
        y: getAvatarEyeHeight(DEFAULT_AVATAR_APPEARANCE),
        z: 0,
      },
      renderYaw: 0,
      appearance: DEFAULT_AVATAR_APPEARANCE,
    });

    expect(transform.rotation).toEqual([0, Math.PI, 0]);
  });

  it("changes the boundary reset key when any appearance selection changes", () => {
    const initial = getRemoteAppearanceKey(DEFAULT_AVATAR_APPEARANCE);
    const changed = getRemoteAppearanceKey({
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        hair: "hairBrown",
      },
    });

    expect(changed).not.toBe(initial);
    expect(getRemoteAppearanceKey(DEFAULT_AVATAR_APPEARANCE)).toBe(initial);
  });
});
