import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { DEFAULT_AVATAR_APPEARANCE } from "../modules/metaverse3d/avatar/avatarAppearance";
import { useAvatarPreferenceStore } from "../modules/metaverse3d/avatar/avatarPreferenceStore";
import AvatarCustomizer from "./AvatarCustomizer";

const authMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  loadAuth: vi.fn(),
  saveAuth: vi.fn(),
  updateMyAvatar: vi.fn(),
  emitPlayerAppearance: vi.fn(),
}));

vi.mock("@/app/api/auth", () => ({
  getMe: authMocks.getMe,
  loadAuth: authMocks.loadAuth,
  saveAuth: authMocks.saveAuth,
  updateMyAvatar: authMocks.updateMyAvatar,
}));

vi.mock("@/app/modules/metaverse3d/network/socketClient", () => ({
  emitPlayerAppearance: authMocks.emitPlayerAppearance,
}));

vi.mock("@/app/components/avatar/AvatarPreviewCanvas", () => ({
  AvatarPreviewCanvas: ({ appearance }: { appearance: { hair: string } }) => (
    <div data-testid="avatar-preview">{appearance.hair}</div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/avatar"]}>
      <I18nProvider>
        <AvatarCustomizer />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe("AvatarCustomizer", () => {
  beforeEach(() => {
    localStorage.clear();
    authMocks.getMe.mockReset();
    authMocks.loadAuth.mockReset();
    authMocks.saveAuth.mockReset();
    authMocks.updateMyAvatar.mockReset();
    authMocks.emitPlayerAppearance.mockReset();
    useAvatarPreferenceStore.setState({
      appearance: { ...DEFAULT_AVATAR_APPEARANCE, colors: { ...DEFAULT_AVATAR_APPEARANCE.colors } },
      source: "default",
      dirty: false,
    });
  });

  afterEach(cleanup);

  it("lets a guest edit and save a versioned local avatar", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    authMocks.getMe.mockRejectedValue(new Error("signed out"));
    renderPage();

    await screen.findByRole("tab", { name: "髮型" });
    act(() => {
      useAvatarPreferenceStore.getState().setAppearance({
        ...DEFAULT_AVATAR_APPEARANCE,
        hair: "hair02",
      });
    });
    expect(screen.getByTestId("avatar-preview")).toHaveTextContent("hair02");

    fireEvent.click(screen.getByRole("button", { name: "儲存角色" }));
    await waitFor(() => {
      expect(useAvatarPreferenceStore.getState().dirty).toBe(false);
    });
    expect(JSON.parse(localStorage.getItem("mrei.avatar.v1") ?? "{}")).toMatchObject({
      version: 1,
      hair: "hair02",
    });
  });

  it("saves an account avatar through the API and emits a room update", async () => {
    const user = {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      avatarAppearance: DEFAULT_AVATAR_APPEARANCE,
    };
    authMocks.loadAuth.mockReturnValue({
      token: "session-token",
      user,
      source: "none",
    });
    authMocks.updateMyAvatar.mockImplementation(async (_token, appearance) => ({
      avatarAppearance: appearance,
    }));
    renderPage();

    await screen.findByRole("tab", { name: "上衣" });
    act(() => {
      useAvatarPreferenceStore.getState().setAppearance({
        ...DEFAULT_AVATAR_APPEARANCE,
        top: "top03",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存角色" }));

    await waitFor(() => expect(authMocks.updateMyAvatar).toHaveBeenCalled());
    expect(authMocks.emitPlayerAppearance).toHaveBeenCalledWith(
      expect.objectContaining({ top: "top03" }),
    );
    expect(authMocks.saveAuth).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({
        avatarAppearance: expect.objectContaining({ top: "top03" }),
      }),
    }));
  });
});
