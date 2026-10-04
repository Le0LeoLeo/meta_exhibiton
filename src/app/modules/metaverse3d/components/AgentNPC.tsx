import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, UserRound } from "lucide-react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { getAgentVisualConfig } from "../agent/config";
import { GuideRobot } from "./GuideRobot";
import { useTouchControls } from '../input/useTouchControls';
import { useI18n } from '../../../components/I18nProvider';

export function AgentNPC() {
  const { t } = useI18n();
  const touchControls = useTouchControls();
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
    if (agent.isAnswering) return t('agentUi.statusThinking');
    if (agent.mode === "follow") return t('agentUi.statusFollowing');
    if (agent.mode === "guide") return t('agentUi.statusExplaining');
    if (agent.mode === "wander") return t('agentUi.statusWandering');
    if (agent.mode === "tour") return t('agentUi.statusTouring');
    return t('agentUi.statusWaiting');
  }, [agent.enabled, agent.isAnswering, agent.mode, t]);

  const bubbleMessage = useMemo(() => {
    const recent = [...agentChat].reverse().find((msg) => Date.now() - msg.createdAt < 8000);
    if (recent) return recent;
    if (agent.currentDialogue) {
      return { role: "assistant" as const, content: agent.currentDialogue, createdAt: Date.now() };
    }
    if (agent.lastQuestion) {
      return { role: "user" as const, content: t('agentUi.lastQuestion', { question: agent.lastQuestion }), createdAt: Date.now() };
    }
    return null;
  }, [agent.currentDialogue, agent.lastQuestion, agentChat, t]);

  const bubbleText = bubbleMessage?.content ?? t('agentUi.openChatHint');
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
        <GuideRobot accent={visual.accent} personality={agent.personality} mode={agent.mode} thinking={agent.isAnswering} />
      </group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 16]} />
        <meshBasicMaterial color={visual.accent} transparent opacity={0.12} />
      </mesh>
      {!touchControls && <Html position={[0, bubbleOffsetY, 0]} center occlude>
        <div className={`pointer-events-none relative flex min-w-[10rem] max-w-[16rem] flex-col gap-1 rounded-2xl border px-3 py-2 text-[11px] shadow-lg backdrop-blur-md transition-all duration-300 ${bubbleVisible ? "translate-y-0 opacity-100" : "translate-y-1 scale-[0.98] opacity-0"}`} style={{ borderColor: `${visual.accent}66`, backgroundColor: bubbleRole === "user" ? "rgba(8, 47, 73, 0.82)" : "rgba(2, 6, 23, 0.82)", color: bubbleRole === "user" ? "#cffafe" : "#e0f2fe" }}>
          <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r" style={{ borderColor: `${visual.accent}66`, backgroundColor: bubbleRole === "user" ? "rgba(8, 47, 73, 0.82)" : "rgba(2, 6, 23, 0.82)" }} />
          <div className="flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-slate-300">
            <Bot className="size-3" />
            {t(`agentPersonality${agent.personality.charAt(0).toUpperCase() + agent.personality.slice(1)}Label`)} Agent · {label}
          </div>
          <div className="flex items-start gap-2 text-left text-xs leading-snug">
            {bubbleRole === "user" ? <UserRound className="mt-0.5 size-3.5 shrink-0 text-cyan-200" /> : <Bot className="mt-0.5 size-3.5 shrink-0 text-cyan-200" />}
            <span className="whitespace-normal break-words">{bubbleText}</span>
          </div>
        </div>
      </Html>}
    </group>
  );
}
