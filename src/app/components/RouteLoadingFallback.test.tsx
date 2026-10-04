import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { RouteLoadingFallback } from "./RouteLoadingFallback";

beforeEach(() => localStorage.setItem("metaexpo-locale", "zh-TW"));
afterEach(() => { cleanup(); localStorage.removeItem("metaexpo-locale"); });

describe("RouteLoadingFallback", () => {
  it("exposes a non-empty loading status", () => {
    render(<I18nProvider><RouteLoadingFallback /></I18nProvider>);

    expect(screen.getByRole("status")).toHaveTextContent("正在載入展覽");
  });
});
