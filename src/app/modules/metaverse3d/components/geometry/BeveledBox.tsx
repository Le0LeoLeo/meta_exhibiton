import type { ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  createBeveledBoxGeometry,
  DEFAULT_BEVEL_RADIUS,
  DEFAULT_BEVEL_SEGMENTS,
  type BoxDimensions,
} from "./beveledBoxGeometry";

export interface BeveledBoxProps
  extends Omit<ThreeElements["mesh"], "dispose" | "geometry"> {
  dimensions: BoxDimensions;
  bevelRadius?: number;
  bevelSegments?: number;
}

export function BeveledBox({
  dimensions,
  bevelRadius = DEFAULT_BEVEL_RADIUS,
  bevelSegments = DEFAULT_BEVEL_SEGMENTS,
  ...meshProps
}: BeveledBoxProps) {
  const [width, height, depth] = dimensions;
  const geometry = useMemo(
    () =>
      createBeveledBoxGeometry(
        [width, height, depth],
        bevelRadius,
        bevelSegments,
      ),
    [bevelRadius, bevelSegments, depth, height, width],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <mesh {...meshProps} geometry={geometry} dispose={null} />;
}
