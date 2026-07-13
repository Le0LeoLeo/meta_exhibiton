import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, UserRound } from "lucide-react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { useStore } from "../store/useStore";
import { getAgentVisualConfig } from "../agent/config";
import { CanvasAssetBoundary } from "./CanvasAssetBoundary";

function AgentModel({ modelUrl, accent, scale, yOffset, rotation }: { modelUrl: string; accent: string; scale: number; yOffset: number; rotation: [number, number, number] }) {
  const gltf = useLoader(GLTFLoader, modelUrl);

  const model = useMemo(() => {
    const source = gltf.scene ?? gltf.scenes?.[0];
    const cloned = source.clone(true);
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z, 0.0001);
    const normalizedScale = (1.1 / maxAxis) * scale;

    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
      child.frustumCulled = true;
      const sourceMaterial = child.material;
      const applyMaterial = (material: THREE.Material) => {
        const clonedMaterial = material.clone();
        if (clonedMaterial instanceof THREE.MeshStandardMaterial || clonedMaterial instanceof THREE.MeshPhysicalMaterial) {
          if (clonedMaterial.color) clonedMaterial.color = clonedMaterial.color.clone().lerp(new THREE.Color(accent), 0.02);
          clonedMaterial.side = THREE.FrontSide;
          clonedMaterial.needsUpdate = true;
        }
        return clonedMaterial;
      };
      child.material = Array.isArray(sourceMaterial) ? sourceMaterial.map(applyMaterial) : applyMaterial(sourceMaterial);
    });

    cloned.scale.setScalar(normalizedScale);
    cloned.position.set(-center.x * normalizedScale, -box.min.y * normalizedScale + yOffset, -center.z * normalizedScale);
    cloned.rotation.set(rotation[0], rotation[1], rotation[2]);
    cloned.updateMatrixWorld(true);
    return cloned;
  }, [gltf, accent, scale, yOffset, rotation]);

  return <primitive object={model} />;
}

function AgentModelFallback({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow={false} receiveShadow={false}>
        <capsuleGeometry args={[0.18, 0.55, 8, 16]} />
        <meshStandardMaterial color={accent} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[0.19, 18, 18]} />
        <meshStandardMaterial color="#e0f2fe" roughness={0.5} metalness={0.02} />
      </mesh>
      <mesh position={[0, 1.14, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.16, 0.012, 8, 28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export function AgentNPC() {
  const agent = useStore((state) => state.agent);
  const agentChat = useStore((state) => state.agentChat);
  const mode = useStore((state) => state.mode);
  const visible = agent.enabled && (mode !== "edit" || agent.visibleInEdit) && (mode !== "floor-plan" || agent.visibleInFloorPlan);
  const groupRef = useRef<THREE.Group>(null);
  const bobRef = useRef(0);
  const visual = useMemo(() => getAgentVisualConfig(agent.personality), [agent.personality]);

  useFrame((_, delta) => {
    if (!groupRef.current || !visible) return;
    bobRef.current += delta * (agent.mode === "follow" ? 8 : 4);
    groupRef.current.position.set(agent.position[0], agent.position[1] + Math.sin(bobRef.current) * 0.02, agent.position[2]);
    groupRef.current.rotation.y = agent.rotationY;
  });

  const label = useMemo(() => {
    if (!agent.enabled) return "";
    if (agent.isAnswering) return "思考中...";
    if (agent.mode === "follow") return "跟隨中";
    if (agent.mode === "guide") return "講解中";
    if (agent.mode === "wander") return "漫遊中";
    if (agent.mode === "tour") return "巡展中";
    return "待命";
  }, [agent.enabled, agent.isAnswering, agent.mode]);

  const bubbleMessage = useMemo(() => {
    const recent = [...agentChat].reverse().find((msg) => Date.now() - msg.createdAt < 8000);
    if (recent) return recent;
    if (agent.currentDialogue) {
      return { role: "assistant" as const, content: agent.currentDialogue, createdAt: Date.now() };
    }
    if (agent.lastQuestion) {
      return { role: "user" as const, content: `你剛剛問我：${agent.lastQuestion}`, createdAt: Date.now() };
    }
    return null;
  }, [agent.currentDialogue, agent.lastQuestion, agentChat]);

  const bubbleText = bubbleMessage?.content ?? "點我或開啟對話，和我聊聊展品吧。";
  const bubbleRole = bubbleMessage?.role ?? "assistant";
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [bubbleOffsetY, setBubbleOffsetY] = useState(1.95);

  useEffect(() => {
    if (!bubbleMessage) {
      setBubbleVisible(true);
      setBubbleOffsetY(1.95);
      return;
    }
    setBubbleVisible(true);
    setBubbleOffsetY(bubbleMessage.role === "user" ? 2.08 : 1.95);
    const timer = window.setTimeout(() => setBubbleVisible(false), 6500);
    return () => window.clearTimeout(timer);
  }, [bubbleMessage]);

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      <group position={[0, 0.03, 0]}>
        <CanvasAssetBoundary resetKey={visual.modelUrl} fallback={<AgentModelFallback accent={visual.accent} />}>
          <AgentModel
            modelUrl={visual.modelUrl}
            accent={visual.accent}
            scale={visual.scale}
            yOffset={visual.yOffset}
            rotation={visual.rotation}
          />
        </CanvasAssetBoundary>
      </group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color={visual.accent} transparent opacity={0.12} />
      </mesh>
      <Html position={[0, bubbleOffsetY, 0]} center occlude>
        <div className={`pointer-events-none relative flex min-w-[10rem] max-w-[16rem] flex-col gap-1 rounded-2xl border px-3 py-2 text-[11px] shadow-lg backdrop-blur-md transition-all duration-300 ${bubbleVisible ? "translate-y-0 opacity-100" : "translate-y-1 scale-[0.98] opacity-0"}`} style={{ borderColor: `${visual.accent}66`, backgroundColor: bubbleRole === "user" ? "rgba(8, 47, 73, 0.82)" : "rgba(2, 6, 23, 0.82)", color: bubbleRole === "user" ? "#cffafe" : "#e0f2fe" }}>
          <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r" style={{ borderColor: `${visual.accent}66`, backgroundColor: bubbleRole === "user" ? "rgba(8, 47, 73, 0.82)" : "rgba(2, 6, 23, 0.82)" }} />
          <div className="flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-slate-300">
            <Bot className="size-3" />
            {visual.label} Agent · {label}
          </div>
          <div className="flex items-start gap-2 text-left text-xs leading-snug">
            {bubbleRole === "user" ? <UserRound className="mt-0.5 size-3.5 shrink-0 text-cyan-200" /> : <Bot className="mt-0.5 size-3.5 shrink-0 text-cyan-200" />}
            <span className="whitespace-normal break-words">{bubbleText}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}
