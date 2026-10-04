import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";
import { I18nProvider } from "../../../components/I18nProvider";

beforeEach(() => localStorage.setItem("metaexpo-locale", "zh-TW"));
afterEach(() => { cleanup(); localStorage.clear(); });

describe("WebGLRecoveryOverlay", () => {
  it("offers a scene reload after context loss", () => {
    const onReload = vi.fn();

    render(
      <I18nProvider>
        <WebGLRecoveryOverlay onReload={onReload} />
      </I18nProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "重新載入 3D 展覽" }),
    );

    expect(onReload).toHaveBeenCalledOnce();
  });

  it("offers an optional 2D recovery action", () => {
    const onUse2D = vi.fn();

    render(
      <I18nProvider>
        <WebGLRecoveryOverlay onReload={vi.fn()} onUse2D={onUse2D} />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "使用 2D 圖文模式" }));

    expect(onUse2D).toHaveBeenCalledOnce();
  });

  it("keeps editor recovery unchanged when no 2D action is supplied", () => {
    render(
      <I18nProvider>
        <WebGLRecoveryOverlay onReload={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.queryByRole("button", { name: "使用 2D 圖文模式" })).not.toBeInTheDocument();
  });
});
