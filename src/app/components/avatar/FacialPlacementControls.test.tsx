import { useState, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AVATAR_FACIAL_PLACEMENT,
  type AvatarFacialPlacement,
} from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";
import {
  FacialPlacementControls,
  type FacialPlacementLabels,
} from "./FacialPlacementControls";

vi.mock("@/app/components/ui/slider", () => ({
  Slider: ({
    value,
    min,
    max,
    step,
    onFocus,
    onPointerDown,
    onPointerCancel,
    onKeyDown,
    onValueChange,
    onValueCommit,
    "aria-label": ariaLabel,
  }: {
    value: number[];
    min: number;
    max: number;
    step: number;
    onFocus?: () => void;
    onPointerDown?: () => void;
    onPointerCancel?: () => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    "aria-label"?: string;
  }) => (
    <input
      type="range"
      aria-label={ariaLabel}
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onChange={(event) => onValueChange?.([Number(event.currentTarget.value)])}
      onPointerUp={(event) =>
        onValueCommit?.([Number(event.currentTarget.value)])
      }
    />
  ),
}));

const labels: FacialPlacementLabels = {
  help: "Keep features safely on the face.",
  eyes: "Eyes",
  eyeHeight: "Eye height",
  eyeSpacing: "Eye spacing",
  eyeSize: "Eye size",
  eyebrows: "Eyebrows",
  eyebrowHeight: "Eyebrow height",
  eyebrowSpacing: "Eyebrow spacing",
  eyebrowTilt: "Eyebrow tilt",
  mouth: "Mouth",
  mouthHorizontal: "Horizontal position",
  mouthHeight: "Mouth height",
  mouthWidth: "Mouth width",
  mouthHeightScale: "Mouth height scale",
  reset: "Reset facial placement",
};

function freshPlacement(): AvatarFacialPlacement {
  return {
    eyes: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes },
    eyebrows: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows },
    mouth: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth },
  };
}

function Harness({
  onGestureStart = vi.fn(),
  onPreview = vi.fn(),
  onCommit = vi.fn(),
  onCancel = vi.fn(),
  onReset = vi.fn(),
}: Partial<ComponentProps<typeof FacialPlacementControls>>) {
  const [value, setValue] = useState(freshPlacement());
  return (
    <FacialPlacementControls
      value={value}
      labels={labels}
      onGestureStart={onGestureStart}
      onPreview={(next) => {
        setValue(next);
        onPreview(next);
      }}
      onCommit={onCommit}
      onCancel={onCancel}
      onReset={onReset}
    />
  );
}

describe("FacialPlacementControls", () => {
  afterEach(cleanup);

  it("renders ten accessible controls with their bounds and steps", () => {
    render(<Harness />);

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(10);
    expect(screen.getByRole("slider", { name: "Eye height" })).toHaveAttribute(
      "min",
      "-0.1",
    );
    expect(screen.getByRole("slider", { name: "Eye height" })).toHaveAttribute(
      "max",
      "0.1",
    );
    expect(screen.getByRole("slider", { name: "Eye height" })).toHaveAttribute(
      "step",
      "0.005",
    );
    expect(screen.getByRole("slider", { name: "Eye size" })).toHaveAttribute(
      "value",
      "1",
    );
  });

  it("previews movement and commits only when the gesture ends", () => {
    const onGestureStart = vi.fn();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    render(
      <Harness
        onGestureStart={onGestureStart}
        onPreview={onPreview}
        onCommit={onCommit}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Eye height" });

    fireEvent.focus(slider);
    fireEvent.change(slider, { target: { value: "0.035" } });

    expect(onGestureStart).toHaveBeenCalledOnce();
    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        eyes: expect.objectContaining({ offsetY: 0.035 }),
      }),
    );
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        eyes: expect.objectContaining({ offsetY: 0.035 }),
      }),
    );
  });

  it("starts a new gesture for every keyboard adjustment", () => {
    const onGestureStart = vi.fn();
    render(<Harness onGestureStart={onGestureStart} />);
    const slider = screen.getByRole("slider", { name: "Eye height" });

    fireEvent.focus(slider);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(onGestureStart).toHaveBeenCalledTimes(3);
  });

  it("cancels a pointer gesture or keyboard adjustment request", () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    const slider = screen.getByRole("slider", { name: "Eye height" });

    fireEvent.pointerCancel(slider);
    fireEvent.keyDown(slider, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("shows rounded values and exposes the placement-only reset", () => {
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);
    const slider = screen.getByRole("slider", { name: "Eye size" });

    fireEvent.change(slider, { target: { value: "1.23" } });
    expect(screen.getByText("123%")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reset facial placement" }),
    );
    expect(onReset).toHaveBeenCalledOnce();
  });
});
