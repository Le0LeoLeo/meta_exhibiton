import { describe, expect, it, vi } from "vitest";

import { AVATAR_MANIFEST } from "@/app/modules/metaverse3d/avatar/avatarManifest";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";

import { randomizeAvatar } from "./randomizeAvatar";

describe("randomizeAvatar", () => {
  it("returns only IDs allowed by the avatar manifest", () => {
    const appearance = randomizeAvatar(() => 0.42);

    expect(appearance.version).toBe(1);
    expect(appearance.body).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.body));
    expect(appearance.head).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.head));
    expect(appearance.eyes).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.features.eyes),
    );
    expect(appearance.eyebrows).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.features.eyebrows),
    );
    expect(appearance.mouth).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.features.mouth),
    );
    expect(appearance.hair).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.hair));
    expect(appearance.top).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.top));
    expect(appearance.bottom).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.nodes.bottom),
    );
    expect(appearance.shoes).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.nodes.shoes),
    );
    expect(appearance.accessory).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.nodes.accessory),
    );
    expect(appearance.colors.skin).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.colors.skin),
    );
    expect(appearance.colors.hair).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.colors.hair),
    );
    expect(appearance.colors.top).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.colors.top),
    );
    expect(appearance.colors.bottom).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.colors.bottom),
    );
    expect(appearance.colors.shoes).toBeOneOf(
      Object.keys(AVATAR_MANIFEST.colors.shoes),
    );
    expect(appearance.facialPlacement).toEqual(
      DEFAULT_AVATAR_FACIAL_PLACEMENT,
    );
  });

  it("supports a deterministic injected random source", () => {
    const first = randomizeAvatar(() => 0);
    const last = randomizeAvatar(() => 1);

    expect(first).toEqual({
      version: 1,
      body: "body01",
      head: "head01",
      eyes: "eyes01",
      eyebrows: "eyebrows01",
      mouth: "mouth01",
      hair: "hair01",
      top: "top01",
      bottom: "bottom01",
      shoes: "shoes01",
      accessory: "none",
      facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
      colors: {
        skin: "skin01",
        hair: "hairBlack",
        top: "navy",
        bottom: "charcoal",
        shoes: "black",
      },
    });
    expect(last).toEqual({
      version: 1,
      body: "body02",
      head: "head02",
      eyes: "eyes03",
      eyebrows: "eyebrows03",
      mouth: "mouth03",
      hair: "hair03",
      top: "top03",
      bottom: "bottom03",
      shoes: "shoes02",
      accessory: "hat01",
      facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
      colors: {
        skin: "skin06",
        hair: "hairPink",
        top: Object.keys(AVATAR_MANIFEST.colors.top).at(-1),
        bottom: "denim",
        shoes: "red",
      },
    });
  });

  it("samples every appearance field once", () => {
    const random = vi.fn(() => 0.5);

    randomizeAvatar(random);

    expect(random).toHaveBeenCalledTimes(15);
  });

  it("returns fresh nested facial placement objects", () => {
    const first = randomizeAvatar(() => 0);
    const second = randomizeAvatar(() => 0);

    expect(first.facialPlacement).not.toBe(second.facialPlacement);
    expect(first.facialPlacement.eyes).not.toBe(second.facialPlacement.eyes);
    expect(first.facialPlacement.eyebrows).not.toBe(
      second.facialPlacement.eyebrows,
    );
    expect(first.facialPlacement.mouth).not.toBe(second.facialPlacement.mouth);
  });
});
