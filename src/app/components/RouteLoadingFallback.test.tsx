import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoadingFallback } from "./RouteLoadingFallback";

describe("RouteLoadingFallback", () => {
  it("exposes a non-empty loading status", () => {
    render(<RouteLoadingFallback />);

    expect(screen.getByRole("status")).toHaveTextContent("正在載入展覽");
  });
});
