import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR_APPEARANCE,
  type AvatarAppearanceV1,
} from "./avatarAppearance";
import { useAvatarPreferenceStore } from "./avatarPreferenceStore";

const STORAGE_KEY = "mrei.avatar.v1";

const CUSTOM_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body02",
  head: "head02",
  hair: "hair03",
  top: "top03",
  bottom: "bottom03",
  shoes: "shoes02",
  accessory: "glasses01",
  colors: {
    skin: "skin04",
    hair: "hairRed",
    top: "violet",
    bottom: "brown",
    shoes: "white",
  },
};

describe("useAvatarPreferenceStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAvatarPreferenceStore.getState().reset();
  });

  it("starts from a clean default preference", () => {
    const state = useAvatarPreferenceStore.getState();

    expect(state.appearance).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(state.source).toBe("default");
    expect(state.dirty).toBe(false);
  });

  it("keeps guest edits as a draft until they are saved", () => {
    useAvatarPreferenceStore.getState().setAppearance(CUSTOM_APPEARANCE);

    const state = useAvatarPreferenceStore.getState();
    expect(state.appearance).toEqual(CUSTOM_APPEARANCE);
    expect(state.savedAppearance).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(state.source).toBe("guest");
    expect(state.dirty).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("hydrates and canonicalizes a stored guest preference", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...CUSTOM_APPEARANCE,
        hair: "untrusted-hair",
        colors: {
          ...CUSTOM_APPEARANCE.colors,
          top: "untrusted-color",
        },
      }),
    );

    useAvatarPreferenceStore.getState().hydrateGuest();

    const state = useAvatarPreferenceStore.getState();
    expect(state.source).toBe("guest");
    expect(state.dirty).toBe(false);
    expect(state.appearance).toEqual({
      ...CUSTOM_APPEARANCE,
      hair: DEFAULT_AVATAR_APPEARANCE.hair,
      colors: {
        ...CUSTOM_APPEARANCE.colors,
        top: DEFAULT_AVATAR_APPEARANCE.colors.top,
      },
    });
    expect(state.savedAppearance).toEqual(state.appearance);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual(
      state.appearance,
    );
  });

  it("removes malformed guest JSON and falls back to defaults", () => {
    window.localStorage.setItem(STORAGE_KEY, "{malformed");

    useAvatarPreferenceStore.getState().hydrateGuest();

    const state = useAvatarPreferenceStore.getState();
    expect(state.appearance).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(state.source).toBe("default");
    expect(state.dirty).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("hydrates account preferences without writing guest storage", () => {
    useAvatarPreferenceStore.getState().hydrateAccount(CUSTOM_APPEARANCE);

    const state = useAvatarPreferenceStore.getState();
    expect(state.appearance).toEqual(CUSTOM_APPEARANCE);
    expect(state.source).toBe("account");
    expect(state.dirty).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    state.setAppearance(DEFAULT_AVATAR_APPEARANCE);
    expect(useAvatarPreferenceStore.getState().source).toBe("account");
    expect(useAvatarPreferenceStore.getState().dirty).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("marks a changed preference saved", () => {
    useAvatarPreferenceStore.getState().setAppearance(CUSTOM_APPEARANCE);
    useAvatarPreferenceStore.getState().markSaved();

    expect(useAvatarPreferenceStore.getState().dirty).toBe(false);
    expect(useAvatarPreferenceStore.getState().savedAppearance).toEqual(
      CUSTOM_APPEARANCE,
    );
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual(
      CUSTOM_APPEARANCE,
    );
  });

  it("reset clears guest storage and restores the initial state", () => {
    useAvatarPreferenceStore.getState().setAppearance(CUSTOM_APPEARANCE);

    useAvatarPreferenceStore.getState().reset();

    const state = useAvatarPreferenceStore.getState();
    expect(state.appearance).toEqual(DEFAULT_AVATAR_APPEARANCE);
    expect(state.source).toBe("default");
    expect(state.dirty).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
