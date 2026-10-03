import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { VisitorChatPanel } from "./VisitorChatPanel";

function Harness() {
  const [open, setOpen] = useState(false);
  return <VisitorChatPanel open={open} onOpenChange={setOpen} />;
}

const socketMocks = vi.hoisted(() => ({ emitChatMessage: vi.fn(() => true) }));
vi.mock("../../network/socketClient", () => ({
  CHAT_ROLES: new Set(["participant", "editor", "owner"]),
  emitChatMessage: socketMocks.emitChatMessage,
}));
vi.mock("../../../../components/I18nProvider", () => ({
  useI18n: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key, locale: "en" }),
}));

const message = (id: string, by: string, nickname: string, text: string) => ({ roomId: "room-1", id, by, nickname, message: text, createdAt: 0, type: "chat" as const });

describe("VisitorChatPanel", () => {
  beforeEach(() => {
    socketMocks.emitChatMessage.mockClear();
    useMultiplayerStore.setState({ enabled: true, connected: true, role: "participant", selfId: "me", chatMessages: [], remotePlayers: {} });
  });
  afterEach(cleanup);

  it("stays hidden until the visitor has joined a room", () => {
    useMultiplayerStore.setState({ role: null });
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "visitorChatOpen" })).not.toBeInTheDocument();
  });

  it("shows room messages and sends a new one", () => {
    useMultiplayerStore.setState({ chatMessages: [message("1", "peer", "Mia", "What inspired this?"), message("2", "me", "Alex", "Hi")] });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "visitorChatOpen" }));

    const log = screen.getByRole("log");
    expect(log).toHaveTextContent("Mia");
    expect(log).toHaveTextContent("What inspired this?");
    expect(log).toHaveTextContent("visitorChatYou");

    fireEvent.change(screen.getByRole("textbox", { name: "visitorChatPlaceholder" }), { target: { value: "The warm palette" } });
    fireEvent.click(screen.getByRole("button", { name: "visitorChatSend" }));
    expect(socketMocks.emitChatMessage).toHaveBeenCalledWith("The warm palette");
    expect(screen.getByRole("textbox", { name: "visitorChatPlaceholder" })).toHaveValue("");
  });

  it("counts unread messages while collapsed", () => {
    render(<Harness />);
    act(() => { useMultiplayerStore.setState({ chatMessages: [message("1", "peer", "Mia", "Hello")] }); });
    expect(screen.getByRole("button", { name: "visitorChatOpen" })).toHaveTextContent('visitorChatUnread:{"count":1}');
  });

  it("is read-only for viewers", () => {
    useMultiplayerStore.setState({ role: "viewer" });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "visitorChatOpen" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("visitorChatReadOnly");
  });
});
