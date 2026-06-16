import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreloadOverlay } from "./PreloadOverlay";

describe("PreloadOverlay", () => {
  it("shows stage progress and allows early entry once core assets are ready", () => {
    const onEnter = vi.fn();

    render(
      <PreloadOverlay
        stage="nearby"
        progress={62}
        canEnter
        failedAssets={1}
        onEnter={onEnter}
      />,
    );

    expect(screen.getByText("載入附近作品與互動")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByText("1 個資源載入失敗，已略過")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByRole("status")).toHaveTextContent("載入附近作品與互動");

    fireEvent.click(screen.getByRole("button", { name: "先進入展覽" }));

    expect(onEnter).toHaveBeenCalledOnce();
  });
});
