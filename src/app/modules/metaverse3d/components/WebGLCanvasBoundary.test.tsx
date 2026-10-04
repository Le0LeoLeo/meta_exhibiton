import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../components/I18nProvider";
import { WebGLCanvasBoundary } from "./WebGLCanvasBoundary";

function BrokenCanvas() {
  throw new Error("Error creating WebGL context.");
}

beforeEach(() => localStorage.setItem("metaexpo-locale", "zh-TW"));
afterEach(() => { cleanup(); localStorage.clear(); });

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

  it("passes the optional 2D action to recovery", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onUse2D = vi.fn();
    const suppressExpectedWebGLError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", suppressExpectedWebGLError);

    try {
      render(
        <I18nProvider>
          <WebGLCanvasBoundary onReload={vi.fn()} onUse2D={onUse2D}>
            <BrokenCanvas />
          </WebGLCanvasBoundary>
        </I18nProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "使用 2D 圖文模式" }));
      expect(onUse2D).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("error", suppressExpectedWebGLError);
      consoleError.mockRestore();
    }
  });
});
