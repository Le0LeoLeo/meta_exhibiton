import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvatarCustomColorControl } from "./AvatarCustomColorControl";

const labels = {
  title: "Custom shirt color",
  description: "Choose a color or enter a six-digit HEX value.",
  picker: "Choose custom shirt color",
  input: "Custom shirt HEX",
  invalid: "Enter a color in the format #RRGGBB.",
  clear: "Use palette color",
};

afterEach(cleanup);

describe("AvatarCustomColorControl", () => {
  it("commits a valid keyboard-entered HEX value in canonical form", () => {
    const onValueChange = vi.fn();
    render(
      <AvatarCustomColorControl
        value={undefined}
        fallbackColor="#334C73"
        labels={labels}
        onValueChange={onValueChange}
        onClear={() => undefined}
      />,
    );

    const input = screen.getByRole("textbox", { name: labels.input });
    fireEvent.change(input, { target: { value: "#3a7bd5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("#3A7BD5");
    expect(input).toHaveValue("#3A7BD5");
  });

  it("keeps an invalid draft local and exposes accessible feedback", () => {
    const onValueChange = vi.fn();
    render(
      <AvatarCustomColorControl
        value={undefined}
        fallbackColor="#334C73"
        labels={labels}
        onValueChange={onValueChange}
        onClear={() => undefined}
      />,
    );

    const input = screen.getByRole("textbox", { name: labels.input });
    fireEvent.change(input, { target: { value: "red" } });
    fireEvent.blur(input);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(labels.invalid);
  });

  it("commits native picker selections and clears the override", () => {
    const onValueChange = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(
      <AvatarCustomColorControl
        value="#3A7BD5"
        fallbackColor="#334C73"
        labels={labels}
        onValueChange={onValueChange}
        onClear={onClear}
      />,
    );

    expect(screen.getByTestId("avatar-custom-color")).toHaveAttribute(
      "data-selected",
      "true",
    );
    fireEvent.change(
      screen.getByLabelText(labels.picker),
      { target: { value: "#12ab34" } },
    );
    expect(onValueChange).toHaveBeenCalledWith("#12AB34");

    fireEvent.click(screen.getByRole("button", { name: labels.clear }));
    expect(onClear).toHaveBeenCalledTimes(1);

    rerender(
      <AvatarCustomColorControl
        value={undefined}
        fallbackColor="#334C73"
        labels={labels}
        onValueChange={onValueChange}
        onClear={onClear}
      />,
    );
    expect(screen.getByTestId("avatar-custom-color")).toHaveAttribute(
      "data-selected",
      "false",
    );
    expect(
      screen.queryByRole("button", { name: labels.clear }),
    ).not.toBeInTheDocument();
  });

  it("groups continuous native picker previews into one gesture commit", () => {
    const onPickerGestureStart = vi.fn();
    const onPickerPreview = vi.fn();
    const onPickerCommit = vi.fn();
    render(
      <AvatarCustomColorControl
        value={undefined}
        fallbackColor="#334C73"
        labels={labels}
        onValueChange={() => undefined}
        onClear={() => undefined}
        onPickerGestureStart={onPickerGestureStart}
        onPickerPreview={onPickerPreview}
        onPickerCommit={onPickerCommit}
      />,
    );

    const picker = screen.getByLabelText(labels.picker);
    fireEvent.pointerDown(picker);
    fireEvent.input(picker, { target: { value: "#123456" } });
    fireEvent.input(picker, { target: { value: "#234567" } });
    fireEvent.change(picker, { target: { value: "#345678" } });

    expect(onPickerGestureStart).toHaveBeenCalledTimes(1);
    expect(onPickerPreview).toHaveBeenNthCalledWith(1, "#123456");
    expect(onPickerPreview).toHaveBeenNthCalledWith(2, "#234567");
    expect(onPickerCommit).toHaveBeenCalledTimes(1);
    expect(onPickerCommit).toHaveBeenCalledWith("#345678");
  });
});
