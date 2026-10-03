import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DEFAULT_AVATAR_APPEARANCE } from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { AvatarPreviewCanvas, resolveAvatarPreviewPalette } from "./AvatarPreviewCanvas";

vi.mock('@react-three/fiber', () => ({ Canvas: () => <canvas /> }));
afterEach(cleanup);

it('labels a working preview without claiming it is unavailable', () => {
  render(<AvatarPreviewCanvas appearance={DEFAULT_AVATAR_APPEARANCE} previewLabel="Avatar preview" unavailableLabel="Unavailable" />);
  expect(screen.getByRole('img', { name: 'Avatar preview' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Unavailable' })).not.toBeInTheDocument();
});

describe("resolveAvatarPreviewPalette", () => {
  it("uses the custom shirt color for the fallback jacket and accent", () => {
    const palette = resolveAvatarPreviewPalette({
      ...DEFAULT_AVATAR_APPEARANCE,
      colors: {
        ...DEFAULT_AVATAR_APPEARANCE.colors,
        topCustom: "#3A7BD5",
      },
    });

    expect(palette.jacket).toBe("#3A7BD5");
    expect(palette.accent).toBe("#3A7BD5");
  });
});
