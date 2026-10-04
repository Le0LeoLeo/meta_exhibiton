// @vitest-environment jsdom

import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarModelBoundary } from "./AvatarModelBoundary";

afterEach(() => {
  vi.restoreAllMocks();
});

class MaybeBroken extends Component<
  { broken: boolean; children: ReactNode }
> {
  render() {
    if (this.props.broken) throw new Error("avatar failed");
    return this.props.children;
  }
}

describe("AvatarModelBoundary", () => {
  it("renders a fallback and retries after resetKey changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = vi.fn();
    const { rerender } = render(
      <AvatarModelBoundary
        fallback={<div>procedural fallback</div>}
        resetKey="attempt-1"
        onError={onError}
      >
        <MaybeBroken broken>rigged avatar</MaybeBroken>
      </AvatarModelBoundary>,
    );

    expect(screen.getByText("procedural fallback")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();

    rerender(
      <AvatarModelBoundary
        fallback={<div>procedural fallback</div>}
        resetKey="attempt-2"
        onError={onError}
      >
        <MaybeBroken broken={false}>rigged avatar</MaybeBroken>
      </AvatarModelBoundary>,
    );

    expect(screen.getByText("rigged avatar")).toBeInTheDocument();
  });
});
