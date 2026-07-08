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

    expect(screen.getByText("正在準備展覽，資料仍會保留")).toBeInTheDocument();
    expect(screen.getByText("正在載入附近作品與互動，可以先進入後再繼續補載。")).toBeInTheDocument();
    expect(screen.getByText("1 個資源暫時載入失敗，已先略過；展覽資料仍然保留。")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByRole("status")).toHaveTextContent(
      "正在載入附近作品與互動，可以先進入後再繼續補載。 62% 1 個資源暫時載入失敗，已先略過；展覽資料仍然保留。",
    );

    fireEvent.click(screen.getByRole("button", { name: "先進入展覽" }));

    expect(onEnter).toHaveBeenCalledOnce();
  });
});
