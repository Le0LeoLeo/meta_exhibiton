import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LandscapeViewingHint } from "./LandscapeViewingHint";

vi.mock("../../../components/I18nProvider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it("offers an explicit retry and prevents duplicate taps while pending", () => {
  const onRequest = vi.fn();
  const { rerender } = render(<LandscapeViewingHint canLock pending={false} onRequest={onRequest} />);
  fireEvent.click(screen.getByRole("button", { name: "viewEnableLandscape" }));
  expect(onRequest).toHaveBeenCalledOnce();
  rerender(<LandscapeViewingHint canLock pending onRequest={onRequest} />);
  expect(screen.getByRole("button", { name: "viewLandscapePending" })).toBeDisabled();
});

it("lets visitors dismiss the manual rotation hint and keep visiting", () => {
  render(<LandscapeViewingHint canLock={false} pending={false} onRequest={vi.fn()} />);
  expect(screen.getByText("viewRotatePhoneHint")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "viewEnableLandscape" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "viewDismissLandscapeHint" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
