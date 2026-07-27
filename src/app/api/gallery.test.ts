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

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers(init?.headers).get("x-gallery-share-token")).toBe("secret-token");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain("secret-token");
  });

  it("sends capability tokens in a header for PATCH", async () => {
    await updateSharedGallery("secret-token", { title: "Changed" });

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-gallery-share-token")).toBe("secret-token");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: "PATCH",
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
