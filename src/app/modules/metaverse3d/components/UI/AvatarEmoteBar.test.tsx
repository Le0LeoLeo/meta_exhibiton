import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalPlayerStore } from "../../network/localPlayerStore";
import { AvatarEmoteBar } from "./AvatarEmoteBar";

vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("AvatarEmoteBar", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    useLocalPlayerStore.setState({ emote: "none", emoteNonce: 0 });
  });

  it("plays emotes from buttons and number shortcuts", () => {
    render(<AvatarEmoteBar />);

    fireEvent.click(screen.getByRole("button", { name: /avatarEmoteClap/ }));
    expect(useLocalPlayerStore.getState()).toMatchObject({
      emote: "clap",
      emoteNonce: 1,
    });

    fireEvent.keyDown(window, { key: "4" });
    expect(useLocalPlayerStore.getState()).toMatchObject({
      emote: "bow",
      emoteNonce: 2,
    });
  });

  it("collapses phone actions after choosing an emote", () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render(<AvatarEmoteBar />);
    const toggle = screen.getByRole('button', { name: /avatarEmotes/ });
    expect(screen.queryByRole('button', { name: 'avatarEmoteWave' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'avatarEmoteWave' }));
    expect(useLocalPlayerStore.getState().emote).toBe('wave');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'avatarEmoteWave' })).not.toBeInTheDocument();
  });
});
