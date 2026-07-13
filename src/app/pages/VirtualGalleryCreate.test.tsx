import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useMultiplayerStore } from "../modules/metaverse3d/network/multiplayerStore";
import { I18nProvider } from "../components/I18nProvider";
import VirtualGalleryCreate, { canSyncMultiplayerRole } from "./VirtualGalleryCreate";

vi.mock("../components/I18nProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../components/I18nProvider")>();
  return {
    ...actual,
    useI18n: () => ({
      locale: 'zh-TW' as const,
      setLocale: () => {},
      toggleLocale: () => {},
      t: (key: string, values?: Record<string, string | number>) => {
        if (!values) return key;
        return key.replace(/\{(\w+)\}/g, (_match: string, token: string) => {
          const value = values[token];
          return value === undefined || value === null ? _match : String(value);
        });
      },
    }),
  };
});

const api = vi.hoisted(() => ({
  getGalleryById: vi.fn(),
  getSharedGallery: vi.fn(),
  updateSharedGallery: vi.fn(),
}));

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    getGalleryById: api.getGalleryById,
    getSharedGallery: api.getSharedGallery,
    updateSharedGallery: api.updateSharedGallery,
  };
});

vi.mock("../features/metaverse-studio", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../features/metaverse-studio")>();
  return {
    ...actual,
    default: ({ sessionStatus }: { sessionStatus?: React.ReactNode }) => (
      <div>{sessionStatus}<div>Studio loaded</div></div>
    ),
  };
});

const initialMultiplayerState = useMultiplayerStore.getState();

describe("VirtualGalleryCreate multiplayer share flow", () => {
  beforeEach(() => {
    api.getGalleryById.mockReset();
    api.getSharedGallery.mockReset();
    api.updateSharedGallery.mockReset();
    useMultiplayerStore.setState(initialMultiplayerState, true);
    localStorage.clear();
    sessionStorage.clear();
  });

  function sharedGallery(id: string) {
    return {
      gallery: {
        id,
        ownerId: "owner-1",
        title: `Shared ${id}`,
        description: "",
        templateTitle: "",
        templateImage: "",
        category: "art",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        sceneJson: JSON.stringify({ items: [] }),
      },
      access: { viaShare: true as const, role: "editor" as const },
    };
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
      resolve = resolvePromise;
    });
    return { promise, resolve };
  }

  afterEach(() => {
    cleanup();
    useMultiplayerStore.setState(initialMultiplayerState, true);
  });

  it("loads the existing gallery share route and configures its multiplayer token", async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/editor-token"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(api.getSharedGallery).toHaveBeenCalledWith("editor-token");
      expect(useMultiplayerStore.getState().shareToken).toBe("editor-token");
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-1");
      expect(useMultiplayerStore.getState().enabled).toBe(true);
    });
  });

  it("ignores a query roomId for an existing gallery session", async () => {
    localStorage.setItem("auth_token", "jwt-owner");
    localStorage.setItem("auth_user", JSON.stringify({
      id: "owner-1",
      email: "owner@example.com",
      name: "Owner",
    }));
    api.getGalleryById.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/create",
        element: <VirtualGalleryCreate />,
      }],
      {
        initialEntries: [
          "/virtual-gallery/create?exhibitionId=gallery-1&roomId=attacker-room",
        ],
      },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-1");
    });
  });

  it("immediately clears prior multiplayer authorization before loading another share", async () => {
    const pending = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockReturnValue(pending.promise);
    useMultiplayerStore.getState().setConnected(true);
    useMultiplayerStore.getState().setRole("owner");
    useMultiplayerStore.getState().setShareToken("old-token");
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/new-token"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(api.getSharedGallery).toHaveBeenCalledWith("new-token");
      expect(useMultiplayerStore.getState().connected).toBe(false);
      expect(useMultiplayerStore.getState().role).toBeNull();
      expect(useMultiplayerStore.getState().shareToken).toBe("");
    });
  });

  it("ignores a stale share response after navigating to a newer token", async () => {
    const first = deferred<ReturnType<typeof sharedGallery>>();
    const second = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockImplementation((token: string) => (
      token === "token-a" ? first.promise : second.promise
    ));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/token-a"] },
    );

    render(<RouterProvider router={router} />);
    await waitFor(() => expect(api.getSharedGallery).toHaveBeenCalledWith("token-a"));
    await router.navigate("/virtual-gallery/share/token-b");
    await waitFor(() => expect(api.getSharedGallery).toHaveBeenCalledWith("token-b"));

    await act(async () => {
      second.resolve(sharedGallery("gallery-b"));
      await second.promise;
    });
    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-b");
      expect(useMultiplayerStore.getState().shareToken).toBe("token-b");
    });

    await act(async () => {
      first.resolve(sharedGallery("gallery-a"));
      await first.promise;
    });

    await waitFor(() => {
      expect(useMultiplayerStore.getState().roomId).toBe("gallery-b");
      expect(useMultiplayerStore.getState().shareToken).toBe("token-b");
    });
  });

  it("ignores an old save response after navigating to another share", async () => {
    const oldSave = deferred<ReturnType<typeof sharedGallery>>();
    api.getSharedGallery.mockImplementation((token: string) => (
      Promise.resolve(sharedGallery(token === "token-a" ? "gallery-a" : "gallery-b"))
    ));
    api.updateSharedGallery.mockReturnValue(oldSave.promise);
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/token-a"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("vgcStatusEditingShared gallery-a");
    fireEvent.click(screen.getByRole("button", { name: "vgcBtnSave" }));
    await waitFor(() => {
      expect(api.updateSharedGallery).toHaveBeenCalledWith(
        "token-a",
        expect.objectContaining({ sceneJson: expect.any(String) }),
      );
    });

    await router.navigate("/virtual-gallery/share/token-b");
    await screen.findByText("vgcStatusEditingShared gallery-b");

    await act(async () => {
      oldSave.resolve(sharedGallery("gallery-a"));
      await oldSave.promise;
    });

    expect(localStorage.getItem("metaverse-gallery-sync")).toBeNull();
    expect(screen.getByText("vgcStatusEditingShared gallery-b")).toBeInTheDocument();
  });

  it("shows room authorization errors and disables saving", async () => {
    api.getSharedGallery.mockResolvedValue(sharedGallery("gallery-1"));
    const router = createMemoryRouter(
      [{
        path: "/virtual-gallery/share/:token",
        element: <VirtualGalleryCreate />,
      }],
      { initialEntries: ["/virtual-gallery/share/editor-token"] },
    );

    render(<RouterProvider router={router} />);
    await screen.findByText("vgcStatusEditingShared gallery-1");

    act(() => {
      useMultiplayerStore.getState().setRoomError({
        code: "FORBIDDEN",
        message: "Editing access was revoked",
      });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Editing access was revoked");
    expect(screen.getByRole("button", { name: "vgcBtnSave" })).toBeDisabled();
  });

  it.each([
    ["viewer", false],
    ["participant", false],
    ["editor", true],
    ["owner", true],
    [null, false],
  ] as const)("allows privileged scene sync for %s: %s", (role, expected) => {
    expect(canSyncMultiplayerRole(role)).toBe(expected);
  });
});
