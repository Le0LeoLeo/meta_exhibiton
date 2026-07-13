import { useMultiplayerStore } from "../../network/multiplayerStore";

export function MultiplayerRoomError() {
  const roomError = useMultiplayerStore((state) => state.roomError);

  if (!roomError) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-500/40 bg-red-950/70 px-3 py-2 text-sm text-red-100"
    >
      {roomError.message}
    </div>
  );
}
