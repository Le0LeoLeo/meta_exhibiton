import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import { useLocalPlayerStore } from "../network/localPlayerStore";
import { AGENT_GROUND_Y } from "./movementHelpers";
import { buildDoorGraph, buildRoomBounds, toExhibitData } from "./behaviorHelpers";
import { runAgentBehaviors } from "./agentBehaviors";
import { resolveVisitorFocus } from './companion';

export function useAgentBehavior({
  allowMotion = true,
}: {
  allowMotion?: boolean;
} = {}) {
  const mode = useStore((state) => state.mode);
  const roomSize = useStore((state) => state.roomSize);
  const items = useStore((state) => state.items);
  const floorPlanElements = useStore((state) => state.floorPlanElements);
  const agent = useStore((state) => state.agent);
  const setAgent = useStore((state) => state.setAgent);
  const setAgentDialogue = useStore((state) => state.setAgentDialogue);
  const setAgentNearbyExhibit = useStore((state) => state.setAgentNearbyExhibit);
  const setAgentActiveExhibit = useStore((state) => state.setAgentActiveExhibit);
  const setAgentRecommendedExhibit = useStore((state) => state.setAgentRecommendedExhibit);
  const markAgentTourArrived = useStore((state) => state.markAgentTourArrived);
  const markAgentTourExplained = useStore((state) => state.markAgentTourExplained);
  const localPlayer = useLocalPlayerStore((state) => state.position);

  const lastWanderTargetRef = useRef(new THREE.Vector3(0, AGENT_GROUND_Y, 0));
  const guideTimerRef = useRef(0);
  const thinkingTimerRef = useRef(0);
  const lastGuidedExhibitIdRef = useRef<string | null>(null);
  const lastGuideAtRef = useRef(0);
  const tourIndexRef = useRef(0);
  const routeWaypointIndexRef = useRef(0);
  const movementAccumulatorRef = useRef(0);
  const movementTickRef = useRef(0);
  const requestingGuideRef = useRef(false);
  const lastTourTargetIdRef = useRef<string | null>(null);
  const lastGuidedRequestKeyRef = useRef<string | null>(null);
  const lastTourSessionSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const nearbyExhibits = useMemo(() => toExhibitData(items), [items]);
  const tourExhibits = useMemo(() => {
    const routeExhibitIds = agent.tourSession.routeExhibitIds;
    if (routeExhibitIds.length > 0) {
      const exhibitsById = new Map(nearbyExhibits.map((exhibit) => [exhibit.id, exhibit]));
      return routeExhibitIds
        .map((exhibitId) => exhibitsById.get(exhibitId))
        .filter((exhibit): exhibit is (typeof nearbyExhibits)[number] => Boolean(exhibit));
    }

    return [...nearbyExhibits].sort((a, b) => (a.position[2] - b.position[2]) || (a.position[0] - b.position[0]));
  }, [agent.tourSession.routeExhibitIds, nearbyExhibits]);
  const roomBounds = useMemo(() => buildRoomBounds(roomSize, floorPlanElements), [roomSize, floorPlanElements]);
  const doorGraph = useMemo(() => buildDoorGraph(roomBounds), [roomBounds]);
  const agentPosition = agent.position ?? [0, AGENT_GROUND_Y, 2.5];

  useEffect(() => {
    const focus = resolveVisitorFocus(nearbyExhibits, [localPlayer.x, localPlayer.y, localPlayer.z], useStore.getState().viewingItem?.id ?? null);
    if (useStore.getState().agent.nearbyExhibitId !== (focus?.id ?? null)) setAgentNearbyExhibit(focus?.id ?? null);
  }, [localPlayer, nearbyExhibits, setAgentNearbyExhibit]);

  useEffect(() => {
    if (agent.participationMode === "solo") {
      setAgent({ enabled: false, mode: "idle", isChatOpen: false, isAnswering: false, answerSource: null, pendingQuestion: "", followUser: false, activeExhibit: null });
    }
  }, [agent.participationMode, setAgent]);

  useFrame((_, delta) => {
    if (!allowMotion) return;

    movementTickRef.current += delta;
    const frameDelta = movementTickRef.current;
    movementTickRef.current = 0;

    const current = new THREE.Vector3(agentPosition[0], AGENT_GROUND_Y, agentPosition[2]);
    const playerPos = new THREE.Vector3(localPlayer.x, AGENT_GROUND_Y, localPlayer.z);

    runAgentBehaviors({
      mode,
      roomSize,
      agent,
      current,
      playerPos,
      nearbyExhibits,
      tourExhibits,
      roomBounds,
      doorGraph,
      viewingItem: useStore.getState().viewingItem,
      refs: {
        lastWanderTargetRef,
        guideTimerRef,
        thinkingTimerRef,
        lastGuidedExhibitIdRef,
        lastGuideAtRef,
        tourIndexRef,
        routeWaypointIndexRef,
        movementAccumulatorRef,
        movementTickRef,
        requestingGuideRef,
        lastTourTargetIdRef,
        lastGuidedRequestKeyRef,
        lastTourSessionSignatureRef,
      },
      deltaSeconds: frameDelta,
      actions: {
        setAgent,
        setAgentDialogue,
        setAgentRecommendedExhibit,
        setAgentActiveExhibit,
        markAgentTourArrived,
        markAgentTourExplained,
        getAgent: () => useStore.getState().agent,
      },
    });
  });
}
