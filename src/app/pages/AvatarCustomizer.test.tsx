import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../components/I18nProvider";
import { DEFAULT_AVATAR_APPEARANCE } from "../modules/metaverse3d/avatar/avatarAppearance";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "../modules/metaverse3d/avatar/avatarFacialPlacement";
import { useAvatarPreferenceStore } from "../modules/metaverse3d/avatar/avatarPreferenceStore";
import AvatarCustomizer from "./AvatarCustomizer";

const authMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  loadAuth: vi.fn(),
  saveAuth: vi.fn(),
  updateMyAvatar: vi.fn(),
  emitPlayerAppearance: vi.fn(),
  uploadMediaAsset: vi.fn(),
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

vi.mock("@/app/api/media", () => ({
  uploadMediaAsset: authMocks.uploadMediaAsset,
}));

vi.mock("@/app/components/avatar/AvatarPreviewCanvas", () => ({
  AvatarPreviewCanvas: (
    { appearance }: { appearance: { hair: string; topPhotoUrl?: string } },
  ) => (
    <div data-testid="avatar-preview">
      {appearance.hair}:{appearance.topPhotoUrl ?? "no-photo"}
    </div>
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
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("metaexpo-locale", "zh-TW");
    authMocks.getMe.mockReset();
    authMocks.loadAuth.mockReset();
    authMocks.saveAuth.mockReset();
    authMocks.updateMyAvatar.mockReset();
    authMocks.emitPlayerAppearance.mockReset();
    authMocks.uploadMediaAsset.mockReset();
    useAvatarPreferenceStore.setState({
      appearance: { ...DEFAULT_AVATAR_APPEARANCE, colors: { ...DEFAULT_AVATAR_APPEARANCE.colors } },
      savedAppearance: { ...DEFAULT_AVATAR_APPEARANCE, colors: { ...DEFAULT_AVATAR_APPEARANCE.colors } },
      source: "default",
      dirty: false,
    });
  });

  afterEach(cleanup);

  it("applies a curated look and can undo it", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /創意策展人/ }));
    expect(screen.getByTestId("avatar-preview")).toHaveTextContent("hair03");

    fireEvent.click(screen.getByRole("button", { name: "復原外觀" }));
    expect(screen.getByTestId("avatar-preview")).toHaveTextContent("hair01");
  });

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

  it("uploads and removes a photo from the shirt controls", async () => {
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
    authMocks.uploadMediaAsset.mockResolvedValue({
      id: "42f3be8d-1c5a-4a4a-8a53-9a98bc2bd144",
      url: "/api/media/42f3be8d-1c5a-4a4a-8a53-9a98bc2bd144",
    });
    renderPage();

    const topTab = await screen.findByRole("tab", { name: "上衣" });
    topTab.focus();
    fireEvent.keyDown(topTab, { key: "Enter" });
    fireEvent.change(await screen.findByTestId("shirt-photo-input"), {
      target: {
        files: [new File(["photo"], "shirt.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(authMocks.uploadMediaAsset).toHaveBeenCalledWith(
        "session-token",
        expect.objectContaining({ name: "shirt.png" }),
        "avatar",
      );
    });
    expect(screen.getByTestId("avatar-preview")).toHaveTextContent(
      "/api/media/42f3be8d-1c5a-4a4a-8a53-9a98bc2bd144",
    );

    fireEvent.click(screen.getByRole("button", { name: "移除相片" }));
    expect(screen.getByTestId("avatar-preview")).toHaveTextContent("no-photo");
  });

  it("records consecutive keyboard slider changes as separate undoable gestures", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const placementTab = await screen.findByRole("tab", {
      name: "五官位置",
    });
    placementTab.focus();
    fireEvent.keyDown(placementTab, { key: "Enter" });
    const eyeHeight = await screen.findByRole("slider", {
      name: "眼睛高度",
    });
    eyeHeight.focus();
    fireEvent.keyDown(eyeHeight, { key: "ArrowRight" });
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.005);
    fireEvent.keyDown(eyeHeight, { key: "ArrowRight" });
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.01);

    fireEvent.click(screen.getByRole("button", { name: "復原外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.005);
    fireEvent.click(screen.getByRole("button", { name: "復原外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "重做外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.005);
    fireEvent.click(screen.getByRole("button", { name: "重做外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.01);
  });

  it("groups continuous pointer previews into one history entry", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const placementTab = await screen.findByRole("tab", {
      name: "五官位置",
    });
    placementTab.focus();
    fireEvent.keyDown(placementTab, { key: "Enter" });
    const eyeHeight = await screen.findByRole("slider", {
      name: "眼睛高度",
    });
    const sliderRoot = eyeHeight.closest('[data-slot="slider"]');
    expect(sliderRoot).not.toBeNull();
    vi.spyOn(sliderRoot as HTMLElement, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 20,
      top: 0,
      right: 100,
      bottom: 20,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(sliderRoot as HTMLElement, {
      pointerId: 1,
      clientX: 55,
    });
    fireEvent.pointerMove(sliderRoot as HTMLElement, {
      pointerId: 1,
      clientX: 70,
    });
    fireEvent.pointerMove(sliderRoot as HTMLElement, {
      pointerId: 1,
      clientX: 75,
    });
    fireEvent.pointerUp(sliderRoot as HTMLElement, {
      pointerId: 1,
      clientX: 75,
    });

    const finalOffset =
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY;
    expect(finalOffset).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "復原外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "重做外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(finalOffset);
  });

  it("cancels a pointer preview without polluting the next gesture", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const placementTab = await screen.findByRole("tab", {
      name: "五官位置",
    });
    placementTab.focus();
    fireEvent.keyDown(placementTab, { key: "Enter" });
    const eyeHeight = await screen.findByRole("slider", {
      name: "眼睛高度",
    });
    const sliderRoot = eyeHeight.closest('[data-slot="slider"]') as HTMLElement;
    vi.spyOn(sliderRoot, "getBoundingClientRect").mockReturnValue({
      width: 100,
      height: 20,
      top: 0,
      right: 100,
      bottom: 20,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(sliderRoot, { pointerId: 1, clientX: 55 });
    fireEvent.pointerMove(sliderRoot, { pointerId: 1, clientX: 70 });
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBeGreaterThan(0);
    fireEvent.pointerCancel(sliderRoot, { pointerId: 1 });
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0);

    eyeHeight.focus();
    fireEvent.keyDown(eyeHeight, { key: "ArrowRight" });
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0.005);
    fireEvent.click(screen.getByRole("button", { name: "復原外觀" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.facialPlacement.eyes
        .offsetY,
    ).toBe(0);
    expect(
      screen.getByRole("button", { name: "復原外觀" }),
    ).toBeDisabled();
  });

  it("resets only facial placement without changing the rest of the avatar", async () => {
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();
    await screen.findByRole("tab", { name: "五官位置" });

    act(() => {
      useAvatarPreferenceStore.getState().setAppearance({
        ...DEFAULT_AVATAR_APPEARANCE,
        hair: "hair02",
        colors: {
          ...DEFAULT_AVATAR_APPEARANCE.colors,
          skin: "skin04",
        },
        facialPlacement: {
          ...DEFAULT_AVATAR_FACIAL_PLACEMENT,
          eyes: {
            ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes,
            offsetY: 0.05,
          },
        },
      });
    });

    const placementTab = screen.getByRole("tab", { name: "五官位置" });
    placementTab.focus();
    fireEvent.keyDown(placementTab, { key: "Enter" });
    fireEvent.click(
      await screen.findByRole("button", { name: "重設五官位置" }),
    );

    expect(useAvatarPreferenceStore.getState().appearance).toMatchObject({
      hair: "hair02",
      colors: { skin: "skin04" },
      facialPlacement: DEFAULT_AVATAR_FACIAL_PLACEMENT,
    });
  });

  it("commits a custom shirt color as one undoable history entry", async () => {
    localStorage.setItem("metaexpo-locale", "en");
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const colorsTab = await screen.findByRole("tab", { name: "Colors" });
    colorsTab.focus();
    fireEvent.keyDown(colorsTab, { key: "Enter" });
    const input = await screen.findByRole("textbox", {
      name: "Custom shirt HEX",
    });
    fireEvent.change(input, { target: { value: "#3a7bd5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#3A7BD5");

    const undo = screen.getByRole("button", { name: "Undo appearance" });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBeUndefined();
    expect(undo).toBeDisabled();
  });

  it("clears a custom shirt color when a built-in swatch is selected", async () => {
    localStorage.setItem("metaexpo-locale", "en");
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const colorsTab = await screen.findByRole("tab", { name: "Colors" });
    colorsTab.focus();
    fireEvent.keyDown(colorsTab, { key: "Enter" });
    const input = await screen.findByRole("textbox", {
      name: "Custom shirt HEX",
    });
    fireEvent.change(input, { target: { value: "#3a7bd5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#3A7BD5");

    fireEvent.click(
      within(screen.getByRole("group", { name: "top" })).getByRole("button", {
        name: "navy",
      }),
    );
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Undo appearance" }));
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#3A7BD5");
  });

  it("groups continuous native picker previews into one undo entry", async () => {
    localStorage.setItem("metaexpo-locale", "en");
    authMocks.loadAuth.mockReturnValue({ token: null, user: null, source: "none" });
    renderPage();

    const colorsTab = await screen.findByRole("tab", { name: "Colors" });
    colorsTab.focus();
    fireEvent.keyDown(colorsTab, { key: "Enter" });
    const picker = await screen.findByLabelText("Choose custom shirt color");

    fireEvent.pointerDown(picker);
    fireEvent.input(picker, { target: { value: "#123456" } });
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#123456");
    fireEvent.input(picker, { target: { value: "#234567" } });
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#234567");
    fireEvent.change(picker, { target: { value: "#345678" } });
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBe("#345678");

    const undo = screen.getByRole("button", { name: "Undo appearance" });
    fireEvent.click(undo);
    expect(
      useAvatarPreferenceStore.getState().appearance.colors.topCustom,
    ).toBeUndefined();
    expect(undo).toBeDisabled();
  });
});
