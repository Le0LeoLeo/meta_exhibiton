import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";
import { I18nProvider } from "../../../components/I18nProvider";

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
});
