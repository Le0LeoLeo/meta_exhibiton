import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";

describe("WebGLRecoveryOverlay", () => {
  it("offers a scene reload after context loss", () => {
    const onReload = vi.fn();

    render(<WebGLRecoveryOverlay onReload={onReload} />);
    fireEvent.click(
      screen.getByRole("button", { name: "重新載入 3D 展覽" }),
    );

    expect(onReload).toHaveBeenCalledOnce();
  });
});
