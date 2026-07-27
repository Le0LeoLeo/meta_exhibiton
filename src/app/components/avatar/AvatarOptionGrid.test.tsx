import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarOptionGrid } from "./AvatarOptionGrid";

const OPTIONS = [
  { value: "hair01", label: "短髮" },
  { value: "hair02", label: "長髮" },
] as const;

afterEach(cleanup);

describe("AvatarOptionGrid", () => {
  it("exposes a labelled group and selected state", () => {
    render(
      <AvatarOptionGrid
        label="髮型"
        options={OPTIONS}
        value="hair02"
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByRole("group", { name: "髮型" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "短髮" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "長髮" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("selects an option with the keyboard", () => {
    const onValueChange = vi.fn();
    render(
      <AvatarOptionGrid
        label="髮型"
        options={OPTIONS}
        value="hair01"
        onValueChange={onValueChange}
      />,
    );

    const option = screen.getByRole("button", { name: "長髮" });
    expect(option.tagName).toBe("BUTTON");
    fireEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith("hair02");
  });

  it("uses at least a 44px interaction target", () => {
    render(
      <AvatarOptionGrid
        label="髮型"
        options={OPTIONS}
        value="hair01"
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "短髮" })).toHaveClass(
      "min-h-11",
      "min-w-11",
    );
  });
});
