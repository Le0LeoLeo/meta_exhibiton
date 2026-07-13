import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { MultiplayerRoomError } from "./MultiplayerRoomError";

const initialState = useMultiplayerStore.getState();

describe("MultiplayerRoomError", () => {
  beforeEach(() => {
    useMultiplayerStore.setState(initialState, true);
  });

  it("renders the current room error as an accessible alert", () => {
    useMultiplayerStore.getState().setRoomError({
      code: "FORBIDDEN",
      message: "Editing permission was removed",
    });

    render(<MultiplayerRoomError />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Editing permission was removed",
    );
  });
});
