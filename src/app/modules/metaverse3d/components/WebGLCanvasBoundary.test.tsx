import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../components/I18nProvider";
import { WebGLCanvasBoundary } from "./WebGLCanvasBoundary";

function BrokenCanvas() {
  throw new Error("Error creating WebGL context.");
}

describe("WebGLCanvasBoundary", () => {
  it("shows the recovery overlay when WebGL renderer creation throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const suppressExpectedWebGLError = (event: ErrorEvent) => {
      if (event.error instanceof Error && event.error.message === "Error creating WebGL context.") {
        event.preventDefault();
      }
    };
    window.addEventListener("error", suppressExpectedWebGLError);

    try {
      render(
        <I18nProvider>
          <div className="relative h-96 w-96">
            <WebGLCanvasBoundary onReload={vi.fn()}>
              <BrokenCanvas />
            </WebGLCanvasBoundary>
          </div>
        </I18nProvider>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("3D 畫面暫時無法載入")).toBeInTheDocument();
    } finally {
      window.removeEventListener("error", suppressExpectedWebGLError);
      consoleError.mockRestore();
    }
  });
});
