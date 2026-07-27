import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { RenderPerformanceProfile } from "../performanceProfile";
import { BeveledBox } from "./geometry/BeveledBox";
import { createBeveledBoxGeometry } from "./geometry/beveledBoxGeometry";

type CeilingMode = RenderPerformanceProfile["effectiveMode"];
type FixturePosition = readonly [x: number, z: number];

export interface CeilingServiceLayout {
  vents: FixturePosition[];
  sprinklers: FixturePosition[];
  sensors: FixturePosition[];
}

function distributeServicePositions(
  width: number,
  length: number,
  count: number,
  xFraction: number,
): FixturePosition[] {
  const positions: FixturePosition[] = [];
  for (let index = 0; index < count; index += 1) {
    const z = -length / 2 + ((index + 1) / (count + 1)) * length;
    const x = count === 1
      ? xFraction * width
      : (index % 2 === 0 ? -1 : 1) * xFraction * width;
    positions.push([x, z]);
  }
  return positions;
}

export function getCeilingServiceLayout(
  width: number,
  length: number,
  mode: CeilingMode,
): CeilingServiceLayout {
  if (mode === "performance") {
    return { vents: [], sprinklers: [], sensors: [] };
  }

  if (mode === "balanced") {
    return {
      vents: distributeServicePositions(width, length, 1, -0.15),
      sprinklers: distributeServicePositions(
        width,
        length,
        Math.min(3, Math.max(1, Math.ceil(length / 20))),
        0.34,
      ),
      sensors: distributeServicePositions(width, length, 1, 0.08),
    };
  }

  return {
    vents: distributeServicePositions(
      width,
      length,
      Math.min(4, Math.max(2, Math.ceil(length / 18))),
      0.16,
    ),
    sprinklers: distributeServicePositions(
      width,
      length,
      Math.min(7, Math.max(3, Math.ceil(length / 8))),
      0.36,
    ),
    sensors: distributeServicePositions(width, length, 2, 0.08),
  };
}

export function getCeilingFixtureLayout(
  width: number,
  length: number,
  mode: CeilingMode,
): FixturePosition[] {
  if (mode === "performance") return [];

  const stationCount = mode === "quality"
    ? Math.min(8, Math.max(2, Math.ceil(length / 6)))
    : Math.min(4, Math.max(1, Math.ceil(length / 12)));
  const railX = Math.min(width * 0.32, Math.max(0.2, width * 0.24));
  const fixtures: FixturePosition[] = [];

  for (let index = 0; index < stationCount; index += 1) {
    const z = -length / 2 + ((index + 1) / (stationCount + 1)) * length;
    fixtures.push([-railX, z], [railX, z]);
  }

  return fixtures;
}

function getPanelJoints(width: number, length: number, spacing: number) {
  const joints: Array<{
    position: [number, number, number];
    scale: [number, number, number];
  }> = [];

  for (let x = -width / 2 + spacing; x < width / 2 - 0.05; x += spacing) {
    joints.push({
      position: [x, -0.006, 0],
      scale: [0.01, 0.006, length],
    });
  }
  for (let z = -length / 2 + spacing; z < length / 2 - 0.05; z += spacing) {
    joints.push({
      position: [0, -0.006, z],
      scale: [width, 0.006, 0.01],
    });
  }

  return joints;
}

function PanelJoints({
  width,
  length,
  spacing,
}: {
  width: number;
  length: number;
  spacing: number;
}) {
  const joints = useMemo(
    () => getPanelJoints(width, length, spacing),
    [length, spacing, width],
  );
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const transform = new THREE.Object3D();
    joints.forEach((joint, index) => {
      transform.position.set(...joint.position);
      transform.scale.set(...joint.scale);
      transform.updateMatrix();
      meshRef.current?.setMatrixAt(index, transform.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [joints]);

  if (joints.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, joints.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#b8b5ae" roughness={0.94} metalness={0} />
    </instancedMesh>
  );
}

function CeilingFixtures({ layout }: { layout: FixturePosition[] }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const lensRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    layout.forEach(([x, z], index) => {
      transform.position.set(x, -0.14, z);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      bodyRef.current?.setMatrixAt(index, transform.matrix);

      transform.position.set(x, -0.235, z);
      transform.updateMatrix();
      lensRef.current?.setMatrixAt(index, transform.matrix);
    });
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true;
    if (lensRef.current) lensRef.current.instanceMatrix.needsUpdate = true;
  }, [layout]);

  if (layout.length === 0) return null;

  return (
    <>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, layout.length]}>
        <cylinderGeometry args={[0.06, 0.075, 0.19, 12]} />
        <meshStandardMaterial color="#252525" roughness={0.48} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={lensRef} args={[undefined, undefined, layout.length]}>
        <cylinderGeometry args={[0.055, 0.055, 0.008, 12]} />
        <meshStandardMaterial
          color="#fff7df"
          emissive="#ffe9b0"
          emissiveIntensity={0.7}
          roughness={0.55}
          metalness={0}
        />
      </instancedMesh>
    </>
  );
}

function CeilingServices({ layout }: { layout: CeilingServiceLayout }) {
  const ventRef = useRef<THREE.InstancedMesh>(null);
  const sprinklerRef = useRef<THREE.InstancedMesh>(null);
  const sensorRef = useRef<THREE.InstancedMesh>(null);
  const ventGeometry = useMemo(
    () => createBeveledBoxGeometry([0.48, 0.025, 0.22], 0.018, 2),
    [],
  );

  useLayoutEffect(() => {
    const transform = new THREE.Object3D();
    layout.vents.forEach(([x, z], index) => {
      transform.position.set(x, -0.025, z);
      transform.rotation.set(0, index % 2 === 0 ? 0 : Math.PI / 2, 0);
      transform.updateMatrix();
      ventRef.current?.setMatrixAt(index, transform.matrix);
    });
    layout.sprinklers.forEach(([x, z], index) => {
      transform.position.set(x, -0.025, z);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      sprinklerRef.current?.setMatrixAt(index, transform.matrix);
    });
    layout.sensors.forEach(([x, z], index) => {
      transform.position.set(x, -0.018, z);
      transform.rotation.set(0, 0, 0);
      transform.updateMatrix();
      sensorRef.current?.setMatrixAt(index, transform.matrix);
    });
    if (ventRef.current) ventRef.current.instanceMatrix.needsUpdate = true;
    if (sprinklerRef.current) sprinklerRef.current.instanceMatrix.needsUpdate = true;
    if (sensorRef.current) sensorRef.current.instanceMatrix.needsUpdate = true;
  }, [layout]);

  useLayoutEffect(() => () => ventGeometry.dispose(), [ventGeometry]);

  return (
    <>
      {layout.vents.length > 0 && (
        <instancedMesh
          ref={ventRef}
          args={[ventGeometry, undefined, layout.vents.length]}
          dispose={null}
        >
          <meshStandardMaterial color="#8f918d" roughness={0.82} metalness={0.08} />
        </instancedMesh>
      )}
      {layout.sprinklers.length > 0 && (
        <instancedMesh
          ref={sprinklerRef}
          args={[undefined, undefined, layout.sprinklers.length]}
        >
          <cylinderGeometry args={[0.018, 0.026, 0.036, 10]} />
          <meshStandardMaterial color="#a8aaa6" roughness={0.46} metalness={0.38} />
        </instancedMesh>
      )}
      {layout.sensors.length > 0 && (
        <instancedMesh
          ref={sensorRef}
          args={[undefined, undefined, layout.sensors.length]}
        >
          <cylinderGeometry args={[0.052, 0.052, 0.018, 16]} />
          <meshStandardMaterial color="#dddcd7" roughness={0.74} metalness={0} />
        </instancedMesh>
      )}
    </>
  );
}

export interface GalleryCeilingProps {
  width: number;
  length: number;
  height: number;
  mode: CeilingMode;
}

export function GalleryCeiling({
  width,
  length,
  height,
  mode,
}: GalleryCeilingProps) {
  const layout = useMemo(
    () => getCeilingFixtureLayout(width, length, mode),
    [length, mode, width],
  );
  const serviceLayout = useMemo(
    () => getCeilingServiceLayout(width, length, mode),
    [length, mode, width],
  );
  const railX = Math.min(width * 0.32, Math.max(0.2, width * 0.24));
  const showDetails = mode !== "performance";

  return (
    <group position={[0, height, 0]}>
      <BeveledBox
        dimensions={[width, 0.1, length]}
        bevelRadius={0.012}
        position={[0, 0.05, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#eeeae1" roughness={0.92} metalness={0} />
      </BeveledBox>

      {showDetails && (
        <>
          <PanelJoints
            width={width}
            length={length}
            spacing={mode === "quality" ? 1.8 : 2.8}
          />
          {[-railX, railX].map((x) => (
            <BeveledBox
              key={x}
              dimensions={[0.035, 0.035, length * 0.92]}
              bevelRadius={0.006}
              position={[x, -0.028, 0]}
            >
              <meshStandardMaterial color="#292929" roughness={0.52} metalness={0.28} />
            </BeveledBox>
          ))}
          <CeilingFixtures layout={layout} />
          <CeilingServices layout={serviceLayout} />
        </>
      )}
    </group>
  );
}
