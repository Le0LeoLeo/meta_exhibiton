import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gallery3D } from "./Gallery3D";
import { I18nProvider } from "./I18nProvider";

describe("Gallery3D", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the static fallback when WebGL cannot be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    render(
      <I18nProvider>
        <Gallery3D />
      </I18nProvider>,
    );

    expect(screen.getByTestId("gallery3d-webgl-fallback")).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/demo/met-436535.jpg');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/demo/met-45434.jpg');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/demo');
  });
});
