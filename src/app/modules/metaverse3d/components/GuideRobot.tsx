import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { AgentMode, AgentPersonality } from '../agent/types';

/** Locally authored guide: upright on +Y, face toward +Z, no external assets. */
export function GuideRobot({ accent, personality, mode, thinking = false }: {
  accent: string;
  personality: AgentPersonality;
  mode: AgentMode;
  thinking?: boolean;
}) {
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += Math.min(delta, 0.05);
    const t = time.current;
    const moving = mode === 'follow' || mode === 'tour' || mode === 'wander';
    const blend = 1 - Math.exp(-delta * 7);
    if (head.current) {
      head.current.rotation.z = THREE.MathUtils.lerp(head.current.rotation.z,
        thinking ? Math.sin(t * 1.5) * 0.07 : Math.sin(t * 0.8) * 0.025, blend);
      head.current.rotation.y = Math.sin(t * 0.65) * 0.065;
    }
    if (eyes.current) {
      const blink = t % 4.6;
      eyes.current.scale.y = blink > 4.42 ? 0.12 : 1;
    }
    if (leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.lerp(
      leftArm.current.rotation.x, moving ? Math.sin(t * 5) * 0.18 : 0.04, blend);
    if (rightArm.current) {
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x,
        moving ? -Math.sin(t * 5) * 0.18 : mode === 'guide' ? -0.55 : 0.04, blend);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z,
        mode === 'guide' ? 0.4 : 0.12, blend);
    }
  });

  return (
    <group name="exhibition-guide-robot">
      <mesh position={[0, 0.17, 0]} scale={[1, 0.55, 0.85]}>
        <sphereGeometry args={[0.26, 24, 16]} />
        <meshStandardMaterial color="#202d38" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.014, 8, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
      <RoundedBox args={[0.49, 0.53, 0.35]} radius={0.14} smoothness={4} position={[0, 0.53, 0]}>
        <meshStandardMaterial color="#eeeae1" roughness={0.36} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.23, 0.13, 0.024]} radius={0.03} smoothness={3} position={[0, 0.56, 0.18]}>
        <meshStandardMaterial color="#263641" roughness={0.5} />
      </RoundedBox>
      {/* Three luminous strokes form a small gallery badge. */}
      {[-1, 0, 1].map((index) => (
        <mesh key={index} position={[index * 0.048, 0.56, 0.195]}>
          <boxGeometry args={[0.018, index === 0 ? 0.065 : 0.043, 0.008]} />
          <meshBasicMaterial color={accent} />
        </mesh>
      ))}
      <mesh position={[0, 0.83, 0]}>
        <cylinderGeometry args={[0.085, 0.085, 0.15, 16]} />
        <meshStandardMaterial color="#263641" roughness={0.5} />
      </mesh>
      <group ref={head} position={[0, 1.04, 0]}>
        <RoundedBox args={[0.67, 0.46, 0.42]} radius={0.15} smoothness={4}>
          <meshStandardMaterial color="#f5f1e8" roughness={0.3} metalness={0.1} />
        </RoundedBox>
        <RoundedBox args={[0.55, 0.31, 0.09]} radius={0.1} smoothness={4} position={[0, -0.005, 0.196]}>
          <meshStandardMaterial color="#102530" roughness={0.25} metalness={0.25} />
        </RoundedBox>
        <group ref={eyes} position={[0, 0.015, 0.245]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.115, 0, 0]}>
              <capsuleGeometry args={[0.026, personality === 'humor' ? 0.035 : 0.055, 4, 12]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, -0.037, 0.249]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.045, 0.008, 6, 16, Math.PI]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.335, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.085, 0.085, 0.045, 20]} />
            <meshStandardMaterial color={accent} roughness={0.4} metalness={0.15} />
          </mesh>
        ))}
        <mesh position={[0.19, 0.28, 0]}>
          <sphereGeometry args={[0.037, 12, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={thinking ? 0.9 : 0.25} />
        </mesh>
      </group>
      {([-1, 1] as const).map((side) => (
        <group key={side} ref={side === -1 ? leftArm : rightArm} position={[side * 0.3, 0.7, 0]} rotation={[0, 0, side * 0.12]}>
          <mesh>
            <sphereGeometry args={[0.072, 16, 12]} />
            <meshStandardMaterial color="#263641" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.065, 0.16, 6, 16]} />
            <meshStandardMaterial color="#eeeae1" roughness={0.38} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.245, 0]}>
            <sphereGeometry args={[0.067, 16, 12]} />
            <meshStandardMaterial color={accent} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
