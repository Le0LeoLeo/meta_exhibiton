import { useFrame } from "@react-three/fiber";
import { RemotePlayer } from "./RemotePlayer";
import { useMultiplayerStore } from "../../network/multiplayerStore";

export function RemotePlayers() {
  const remotePlayers = useMultiplayerStore((state) => state.remotePlayers);
  const tickInterpolation = useMultiplayerStore((state) => state.tickInterpolation);

  useFrame((_, delta) => {
    const alpha = Math.min(0.35, 0.08 + delta * 6);
    tickInterpolation(alpha);
  });

  return (
    <>
      {Object.values(remotePlayers).map((player) => (
        <RemotePlayer key={player.id} player={player} />
      ))}
    </>
  );
}
