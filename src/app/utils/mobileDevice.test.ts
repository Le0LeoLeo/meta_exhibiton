import { afterEach, describe, expect, it, vi } from "vitest";
import { isMobileDevice } from "./mobileDevice";

afterEach(() => vi.unstubAllGlobals());

describe("mobile device editing policy", () => {
  it.each([390, 844, 1366])("keeps touch devices restricted at width %s", (width) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(isMobileDevice()).toBe(true);
  });
  it.each([390, 1440])("allows a desktop with a fine pointer at width %s", (width) => {
    vi.stubGlobal("innerWidth", width);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("navigator", { userAgent: "Desktop", platform: "Win32", maxTouchPoints: 0 });
    expect(isMobileDevice()).toBe(false);
  });
  it.each(["iPhone", "iPad", "Android"])("keeps %s restricted when a mouse is attached", (userAgent) => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints: 1 });
    expect(isMobileDevice()).toBe(true);
  });
  it("recognizes a tablet using a desktop user agent", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("navigator", { userAgent: "Desktop", platform: "MacIntel", maxTouchPoints: 5 });
    expect(isMobileDevice()).toBe(true);
  });
});
