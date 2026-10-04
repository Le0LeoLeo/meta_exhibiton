import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarColorPalette } from "./AvatarColorPalette";

const COLORS = [
  { value: "navy", label: "海軍藍", color: "#334c73" },
  { value: "rose", label: "玫瑰紅", color: "#b85d73" },
] as const;

afterEach(cleanup);

describe("AvatarColorPalette", () => {
  it("provides readable labels and selected state", () => {
    render(
      <AvatarColorPalette
        label="上衣顏色"
        options={COLORS}
        value="rose"
        onValueChange={() => undefined}
      />,
    );

    expect(
      screen.getByRole("group", { name: "上衣顏色" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "海軍藍" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "玫瑰紅" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("selects a color using a keyboard-operable button", () => {
    const onValueChange = vi.fn();
    render(
      <AvatarColorPalette
        label="上衣顏色"
        options={COLORS}
        value="navy"
        onValueChange={onValueChange}
      />,
    );

    const option = screen.getByRole("button", { name: "玫瑰紅" });
    expect(option.tagName).toBe("BUTTON");
    fireEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith("rose");
  });

  it("uses a 44px touch target", () => {
    render(
      <AvatarColorPalette
        label="上衣顏色"
        options={COLORS}
        value="navy"
        onValueChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "海軍藍" })).toHaveClass(
      "size-11",
    );
  });
});
