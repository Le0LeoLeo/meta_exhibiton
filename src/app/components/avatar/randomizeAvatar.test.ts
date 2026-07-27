import { describe, expect, it, vi } from "vitest";

import { AVATAR_MANIFEST } from "@/app/modules/metaverse3d/avatar/avatarManifest";

import { randomizeAvatar } from "./randomizeAvatar";

describe("randomizeAvatar", () => {
  it("returns only IDs allowed by the avatar manifest", () => {
    const appearance = randomizeAvatar(() => 0.42);

    expect(appearance.version).toBe(1);
    expect(appearance.body).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.body));
    expect(appearance.head).toBeOneOf(Object.keys(AVATAR_MANIFEST.nodes.head));
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
  });

  it("supports a deterministic injected random source", () => {
    const first = randomizeAvatar(() => 0);
    const last = randomizeAvatar(() => 1);

    expect(first).toEqual({
      version: 1,
      body: "body01",
      head: "head01",
      hair: "hair01",
      top: "top01",
      bottom: "bottom01",
      shoes: "shoes01",
      accessory: "none",
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
      hair: "hair03",
      top: "top03",
      bottom: "bottom03",
      shoes: "shoes02",
      accessory: "hat01",
      colors: {
        skin: "skin05",
        hair: "hairRed",
        top: "amber",
        bottom: "brown",
        shoes: "brown",
      },
    });
  });

  it("samples every appearance field once", () => {
    const random = vi.fn(() => 0.5);

    randomizeAvatar(random);

    expect(random).toHaveBeenCalledTimes(12);
  });
});
