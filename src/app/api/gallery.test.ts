import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGalleryShareLink,
  getSharedGallery,
  updateSharedGallery,
} from "./gallery";

describe("gallery capability API", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gallery: {}, access: {} }),
    }));
  });

  it("sends capability tokens in a header for GET", async () => {
    await getSharedGallery("secret-token");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/share/galleries"),
      {
        headers: { "x-gallery-share-token": "secret-token" },
      },
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain("secret-token");
  });

  it("sends capability tokens in a header for PATCH", async () => {
    await updateSharedGallery("secret-token", { title: "Changed" });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/share/galleries"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "x-gallery-share-token": "secret-token",
        }),
      }),
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain("secret-token");
  });

  it("creates a server capability link with the selected role and expiry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        share: {
          url: "https://example.test/virtual-gallery/share/token",
          token: "token",
          role: "editor",
          expiresAt: null,
        },
      }),
    } as Response);

    const result = await createGalleryShareLink(
      "jwt",
      "gallery-1",
      { role: "editor", expiresInHours: 24 },
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/galleries/gallery-1/share-link"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ role: "editor", expiresInHours: 24 }),
      }),
    );
    expect(result.share.url).toContain("/virtual-gallery/share/");
  });
});
