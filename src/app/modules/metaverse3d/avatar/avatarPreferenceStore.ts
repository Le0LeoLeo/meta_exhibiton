import { create } from "zustand";
import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from "./avatarAppearance";

const GUEST_AVATAR_STORAGE_KEY = "mrei.avatar.v1";

export type AvatarPreferenceSource = "default" | "guest" | "account";

export type AvatarPreferenceState = {
  appearance: AvatarAppearanceV1;
  savedAppearance: AvatarAppearanceV1;
  source: AvatarPreferenceSource;
  dirty: boolean;
  setAppearance: (value: AvatarAppearanceV1) => void;
  hydrateGuest: () => void;
  hydrateAccount: (value: AvatarAppearanceV1) => void;
  markSaved: () => void;
  reset: () => void;
};

function defaultAppearance(): AvatarAppearanceV1 {
  return normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE);
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storeGuestAppearance(appearance: AvatarAppearanceV1): void {
  try {
    getLocalStorage()?.setItem(
      GUEST_AVATAR_STORAGE_KEY,
      JSON.stringify(appearance),
    );
  } catch {
    // Guest preferences remain usable in memory when storage is unavailable.
  }
}

function removeGuestAppearance(): void {
  try {
    getLocalStorage()?.removeItem(GUEST_AVATAR_STORAGE_KEY);
  } catch {
    // Resetting the in-memory preference should not depend on storage access.
  }
}

export const useAvatarPreferenceStore = create<AvatarPreferenceState>(
  (set, get) => ({
    appearance: defaultAppearance(),
    savedAppearance: defaultAppearance(),
    source: "default",
    dirty: false,

    setAppearance: (value) => {
      const appearance = normalizeAvatarAppearance(value);
      const source = get().source === "account" ? "account" : "guest";

      set({
        appearance,
        source,
        dirty: true,
      });
    },

    hydrateGuest: () => {
      const storage = getLocalStorage();
      let storedValue: string | null;

      try {
        storedValue = storage?.getItem(GUEST_AVATAR_STORAGE_KEY) ?? null;
      } catch {
        storedValue = null;
      }

      if (storedValue === null) {
        set({
          appearance: defaultAppearance(),
          savedAppearance: defaultAppearance(),
          source: "default",
          dirty: false,
        });
        return;
      }

      try {
        const appearance = normalizeAvatarAppearance(JSON.parse(storedValue));
        storeGuestAppearance(appearance);
        set({
          appearance,
          savedAppearance: appearance,
          source: "guest",
          dirty: false,
        });
      } catch {
        removeGuestAppearance();
        set({
          appearance: defaultAppearance(),
          savedAppearance: defaultAppearance(),
          source: "default",
          dirty: false,
        });
      }
    },

    hydrateAccount: (value) =>
      set({
        appearance: normalizeAvatarAppearance(value),
        savedAppearance: normalizeAvatarAppearance(value),
        source: "account",
        dirty: false,
      }),

    markSaved: () => {
      const { appearance, source } = get();
      if (source === "guest") {
        storeGuestAppearance(appearance);
      }
      set({ savedAppearance: appearance, dirty: false });
    },

    reset: () => {
      removeGuestAppearance();
      set({
        appearance: defaultAppearance(),
        savedAppearance: defaultAppearance(),
        source: "default",
        dirty: false,
      });
    },
  }),
);
