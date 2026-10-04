import { describe, expect, it } from "vitest";
import { displayNickname, guestTag } from "./displayNickname";

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${params.tag}` : key);

describe("displayNickname", () => {
  it("keeps account names unchanged", () => {
    expect(displayNickname("Ms Teacher", "socket-abc123", t)).toBe("Ms Teacher");
  });

  it("gives each guest a localized label with a short stable tag", () => {
    // Socket.IO ids: random prefix, sequential suffix — consecutive guests must still differ.
    expect(displayNickname("Guest", "C8wJL5898itl8QpoAAAX", t)).toBe("multiplayerGuestName:C8WJ");
    expect(displayNickname("Guest", "k2PqZ0m1nXyTu7vWAAAY", t)).toBe("multiplayerGuestName:K2PQ");
    expect(displayNickname("", "C8wJL5898itl8QpoAAAX", t)).toBe("multiplayerGuestName:C8WJ");
  });

  it("falls back to a plain guest label when the id has no usable characters", () => {
    expect(guestTag("--")).toBe("");
    expect(displayNickname("Guest", "--", t)).toBe("multiplayerGuestNameNoTag");
  });
});
