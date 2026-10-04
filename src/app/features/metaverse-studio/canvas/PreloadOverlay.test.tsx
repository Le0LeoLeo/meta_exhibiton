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

    expect(screen.getByText("Preparing the exhibition. Your work is safe.")).toBeInTheDocument();
    expect(screen.getByText("Loading nearby works. You can enter now and they will keep loading.")).toBeInTheDocument();
    expect(screen.getByText("1 item(s) could not load and were skipped. Your exhibition data is unchanged.")).toBeInTheDocument();
    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading nearby works. You can enter now and they will keep loading. 62% 1 item(s) could not load and were skipped. Your exhibition data is unchanged.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Enter now" }));

    expect(onEnter).toHaveBeenCalledOnce();
  });
});
