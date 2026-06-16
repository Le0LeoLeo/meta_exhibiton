import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RemotePlayer } from "./RemotePlayer";
import { useMultiplayerStore } from "../../network/multiplayerStore";
import { useRenderPerformanceProfile } from "../../performanceProfile";

export function RemotePlayers({
  allowMotion = true,
}: {
  allowMotion?: boolean;
}) {
  const remotePlayers = useMultiplayerStore((state) => state.remotePlayers);
  const tickInterpolation = useMultiplayerStore((state) => state.tickInterpolation);
  const performanceProfile = useRenderPerformanceProfile();
  const interpolationAccumulatorRef = useRef(0);

  useFrame((_, delta) => {
    if (!allowMotion || !performanceProfile.enableRemotePlayers) return;

    const interpolationInterval = 1 / performanceProfile.remoteInterpolationFps;
    interpolationAccumulatorRef.current += delta;
    if (interpolationAccumulatorRef.current < interpolationInterval) return;

    const elapsed = interpolationAccumulatorRef.current;
    interpolationAccumulatorRef.current = 0;
    const alpha = Math.min(0.35, 0.08 + elapsed * 6);
    tickInterpolation(alpha);
  });

  if (!performanceProfile.enableRemotePlayers) return null;

  return (
    <>
      {Object.values(remotePlayers).map((player) => (
        <RemotePlayer key={player.id} player={player} />
      ))}
    </>
  );
}
