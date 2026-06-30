import * as THREE from "three";
import type { AgentState } from "./types";
import type { ExhibitItem } from "../types";
import { AGENT_FOLLOW_COMFORT_DISTANCE, AGENT_GUIDE_STOP_DISTANCE, AGENT_GUIDE_TRIGGER_DISTANCE, AGENT_GROUND_Y, AGENT_STOP_DISTANCE, AGENT_TOUR_STOP_DISTANCE, AGENT_WANDER_POINT_REACHED, AGENT_SPEED, shouldPreserveMode, resolveAgentStep } from "./movementHelpers";
import { buildRouteViaDoors, requestAutoGuideAnswer, findClosestExhibit, toExhibitData } from "./behaviorHelpers";
import { getAgentResponse } from "./response";
import type { AgentRecommendation } from "./types";

export type AgentBehaviorContext = {
  mode: string;
  roomSize: { width: number; length: number };
  agent: AgentState;
  current: THREE.Vector3;
  playerPos: THREE.Vector3;
  nearbyExhibits: ReturnType<typeof toExhibitData>;
  tourExhibits: ReturnType<typeof toExhibitData>;
  roomBounds: ReturnType<typeof import("./behaviorHelpers").buildRoomBounds>;
  doorGraph: ReturnType<typeof import("./behaviorHelpers").buildDoorGraph>;
  viewingItem: ExhibitItem | null;
  refs: {
    lastWanderTargetRef: React.MutableRefObject<THREE.Vector3>;
    guideTimerRef: React.MutableRefObject<number>;
    thinkingTimerRef: React.MutableRefObject<number>;
    lastGuidedExhibitIdRef: React.MutableRefObject<string | null>;
    lastGuideAtRef: React.MutableRefObject<number>;
    tourIndexRef: React.MutableRefObject<number>;
    routeWaypointIndexRef: React.MutableRefObject<number>;
    movementAccumulatorRef: React.MutableRefObject<number>;
    movementTickRef: React.MutableRefObject<number>;
    requestingGuideRef: React.MutableRefObject<boolean>;
    lastTourTargetIdRef: React.MutableRefObject<string | null>;
    lastGuidedRequestKeyRef: React.MutableRefObject<string | null>;
    lastTourSessionSignatureRef: React.MutableRefObject<string | null>;
  };
  deltaSeconds: number;
  actions: {
    setAgent: (patch: Partial<AgentState>) => void;
    setAgentDialogue: (content: string) => void;
    setAgentRecommendedExhibit: (recommendation: AgentRecommendation | null) => void;
    setAgentActiveExhibit: (item: ExhibitItem | null) => void;
    markAgentTourArrived: (exhibitId: string) => void;
    markAgentTourExplained: (exhibitId: string) => void;
    getAgent: () => AgentState;
  };
};

function buildTourStopQuestion(agent: AgentState, exhibit: ReturnType<typeof toExhibitData>[number]) {
  const title = exhibit.title || (agent.preferredLanguage === "en" ? "this exhibit" : "這件作品");
  return agent.preferredLanguage === "en"
    ? `Please introduce this stop in the guided tour: ${title}`
    : `請介紹這一站導覽作品：${title}`;
}

function getProgressRouteIds(agent: AgentState, tourExhibits: ReturnType<typeof toExhibitData>) {
  return agent.tourSession.routeExhibitIds.length > 0 ? agent.tourSession.routeExhibitIds : tourExhibits.map((item) => item.id);
}

function buildTourRequestKey(tourRunId: string | null, routeIds: string[], stopIndex: number, exhibitId: string) {
  return JSON.stringify({ tourRunId, routeIds, stopIndex, exhibitId });
}

function hasSameRouteIdentity(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function isCurrentTourRequest({
  latest,
  targetExhibitId,
  currentStopIndex,
  tourRunId,
  progressRouteIds,
  fallbackRouteIds,
}: {
  latest: AgentState;
  targetExhibitId: string;
  currentStopIndex: number;
  tourRunId: string | null;
  progressRouteIds: string[];
  fallbackRouteIds: string[];
}) {
  if (latest.tourSession.status !== "running" && latest.tourSession.status !== "arrived") return false;
  if (latest.tourSession.tourRunId !== tourRunId) return false;
  if (latest.tourSession.currentStopIndex !== currentStopIndex) return false;

  const latestRouteIds = latest.tourSession.routeExhibitIds.length > 0 ? latest.tourSession.routeExhibitIds : fallbackRouteIds;
  if (!hasSameRouteIdentity(latestRouteIds, progressRouteIds)) return false;

  const fallbackTargetId = latestRouteIds[latest.tourSession.currentStopIndex] ?? null;
  return latest.tourSession.currentExhibitId === targetExhibitId || fallbackTargetId === targetExhibitId;
}

function buildTourSessionSignature(agent: AgentState) {
  return JSON.stringify({
    status: agent.tourSession.status,
    tourRunId: agent.tourSession.tourRunId,
    routeIds: agent.tourSession.routeExhibitIds,
    stopIndex: agent.tourSession.currentStopIndex,
    exhibitId: agent.tourSession.currentExhibitId,
  });
}

export function runAgentBehaviors(ctx: AgentBehaviorContext) {
  const { agent, current, playerPos, nearbyExhibits, tourExhibits, roomBounds, doorGraph, viewingItem, refs, actions, deltaSeconds } = ctx;
  const tourSessionSignature = buildTourSessionSignature(agent);
  const previousTourSessionSignature = refs.lastTourSessionSignatureRef.current;
  if (previousTourSessionSignature !== tourSessionSignature) {
    const currentIsRunning = agent.tourSession.status === "running";
    if (currentIsRunning) {
      refs.lastGuidedRequestKeyRef.current = null;
      refs.routeWaypointIndexRef.current = 0;
    }
    refs.lastTourSessionSignatureRef.current = tourSessionSignature;
  }

  const { exhibit: playerNearestExhibit, distance: playerToExhibitDistance } = findClosestExhibit(playerPos, nearbyExhibits);
  const { exhibit: agentNearestExhibit, distance: agentToExhibitDistance } = findClosestExhibit(current, nearbyExhibits);
  const distanceToPlayer = current.distanceTo(playerPos);
  let target = current.clone();
  let nextMode = agent.mode;
  let nextActiveExhibit = playerNearestExhibit ?? null;

  const roomMinX = -ctx.roomSize.width / 2 + 0.8;
  const roomMaxX = ctx.roomSize.width / 2 - 0.8;
  const roomMinZ = -ctx.roomSize.length / 2 + 0.8;
  const roomMaxZ = ctx.roomSize.length / 2 - 0.8;

  if (agent.isAnswering) {
    refs.thinkingTimerRef.current += deltaSeconds;
    if (refs.thinkingTimerRef.current > 1.1) {
      const answer = getAgentResponse({ question: agent.pendingQuestion || agent.lastQuestion, personality: agent.personality, exhibit: agentNearestExhibit, nearbyExhibits });
      actions.setAgentDialogue(answer);
      actions.setAgent({ isAnswering: false, mode: agent.followUser ? "follow" : "idle", pendingQuestion: "" });
      refs.thinkingTimerRef.current = 0;
    }
    return;
  }

  if (viewingItem && agent.followUser) {
    target.copy(new THREE.Vector3(viewingItem.position[0] - 0.85, AGENT_GROUND_Y, viewingItem.position[2] - 0.85));
    nextMode = "guide";
    nextActiveExhibit = viewingItem;
  } else if (agent.followUser && playerNearestExhibit && playerToExhibitDistance <= AGENT_GUIDE_TRIGGER_DISTANCE) {
    const playerToExhibit = new THREE.Vector3(playerNearestExhibit.position[0] - playerPos.x, 0, playerNearestExhibit.position[2] - playerPos.z);
    if (playerToExhibit.lengthSq() > 0.0001) playerToExhibit.normalize(); else playerToExhibit.set(0, 0, -1);
    target.copy(new THREE.Vector3(playerNearestExhibit.position[0] - playerToExhibit.x * 0.95, AGENT_GROUND_Y, playerNearestExhibit.position[2] - playerToExhibit.z * 0.95));
    nextMode = "guide";
    nextActiveExhibit = playerNearestExhibit;
    refs.guideTimerRef.current = agentToExhibitDistance <= AGENT_GUIDE_STOP_DISTANCE ? refs.guideTimerRef.current + deltaSeconds : 0;
  } else if (agent.followUser) {
    const offsetDirection = current.clone().sub(playerPos);
    if (offsetDirection.lengthSq() > 0.0001) offsetDirection.normalize(); else offsetDirection.set(-0.75, 0, -0.55).normalize();
    target.copy(playerPos.clone().addScaledVector(offsetDirection, AGENT_FOLLOW_COMFORT_DISTANCE));
    nextMode = distanceToPlayer > AGENT_STOP_DISTANCE ? "follow" : "idle";
    nextActiveExhibit = null;
    refs.guideTimerRef.current = 0;
  } else if (agent.mode === "tour" && agent.tourSession.status === "running" && tourExhibits.length > 0) {
    const sessionTargetIndex = tourExhibits.findIndex((tourExhibit) => tourExhibit.id === agent.tourSession.currentExhibitId);
    const fallbackIndex = agent.tourSession.currentStopIndex >= 0 ? agent.tourSession.currentStopIndex : refs.tourIndexRef.current;
    const currentIndex = sessionTargetIndex >= 0 ? sessionTargetIndex : fallbackIndex % tourExhibits.length;
    const targetExhibit = tourExhibits[currentIndex];
    if (refs.lastTourTargetIdRef.current !== targetExhibit.id) {
      refs.routeWaypointIndexRef.current = 0;
      refs.lastTourTargetIdRef.current = targetExhibit.id;
    }
    const offset = new THREE.Vector3(current.x - targetExhibit.position[0], 0, current.z - targetExhibit.position[2]);
    if (offset.lengthSq() > 0.0001) offset.normalize(); else offset.set(0.75, 0, 0.5).normalize();
    const finalTourSpot = new THREE.Vector3(targetExhibit.position[0] + offset.x * AGENT_TOUR_STOP_DISTANCE, AGENT_GROUND_Y, targetExhibit.position[2] + offset.z * AGENT_TOUR_STOP_DISTANCE);
    const route = buildRouteViaDoors(current, finalTourSpot, roomBounds, doorGraph);
    const clampedWaypointIndex = Math.min(refs.routeWaypointIndexRef.current, Math.max(0, route.length - 1));
    refs.routeWaypointIndexRef.current = clampedWaypointIndex;
    const waypoint = route[clampedWaypointIndex] ?? finalTourSpot;
    const distanceToWaypoint = current.distanceTo(waypoint);
    const progressRouteIds = getProgressRouteIds(agent, tourExhibits);
    const fallbackRouteIds = tourExhibits.map((item) => item.id);
    const requestKey = buildTourRequestKey(agent.tourSession.tourRunId, progressRouteIds, agent.tourSession.currentStopIndex, targetExhibit.id);
    target.copy(waypoint);
    nextMode = "tour";
    nextActiveExhibit = targetExhibit;
    if (distanceToWaypoint <= 0.35 && clampedWaypointIndex < route.length - 1) refs.routeWaypointIndexRef.current = clampedWaypointIndex + 1;
    if (
      distanceToWaypoint <= 0.35
      && clampedWaypointIndex >= route.length - 1
      && refs.lastGuidedRequestKeyRef.current !== requestKey
    ) {
      refs.requestingGuideRef.current = true;
      refs.lastGuidedRequestKeyRef.current = requestKey;
      actions.markAgentTourArrived(targetExhibit.id);
      actions.setAgent({ activeExhibit: targetExhibit as ExhibitItem });

      requestAutoGuideAnswer({
        question: buildTourStopQuestion(agent, targetExhibit),
        personality: agent.personality,
        exhibit: targetExhibit,
        nearbyExhibits,
        sessionState: {
          sessionId: agent.memory.sessionId,
          tourProgress: {
            currentStopIndex: agent.tourSession.currentStopIndex + 1,
            totalStops: progressRouteIds.length,
            currentExhibitId: targetExhibit.id,
            completedExhibitIds: progressRouteIds.slice(0, agent.tourSession.currentStopIndex),
          },
        },
      })
        .then((result) => {
          const latest = actions.getAgent();
          const isCurrentRequest = isCurrentTourRequest({
            latest,
            targetExhibitId: targetExhibit.id,
            currentStopIndex: agent.tourSession.currentStopIndex,
            tourRunId: agent.tourSession.tourRunId,
            progressRouteIds,
            fallbackRouteIds,
          });
          if (!isCurrentRequest) {
            if (refs.lastGuidedRequestKeyRef.current === requestKey) refs.lastGuidedRequestKeyRef.current = null;
            return;
          }

          actions.setAgentDialogue(result.answer);
          actions.setAgentRecommendedExhibit(result.recommendedExhibit);
          actions.setAgent({
            isAnswering: false,
            currentDialogue: result.answer,
            recommendedExhibit: result.recommendedExhibit,
            memory: {
              ...latest.memory,
              visitedExhibitIds: Array.from(new Set([...latest.memory.visitedExhibitIds, targetExhibit.id])),
              engagedExhibitIds: Array.from(new Set([...latest.memory.engagedExhibitIds, targetExhibit.id])),
              lastRecommendedExhibitId: result.recommendedExhibit?.id ?? latest.memory.lastRecommendedExhibitId,
            },
          });
          actions.markAgentTourExplained(targetExhibit.id);
          refs.routeWaypointIndexRef.current = 0;
        })
        .catch(() => {
          const latest = actions.getAgent();
          const isCurrentRequest = isCurrentTourRequest({
            latest,
            targetExhibitId: targetExhibit.id,
            currentStopIndex: agent.tourSession.currentStopIndex,
            tourRunId: agent.tourSession.tourRunId,
            progressRouteIds,
            fallbackRouteIds,
          });
          if (!isCurrentRequest) {
            if (refs.lastGuidedRequestKeyRef.current === requestKey) refs.lastGuidedRequestKeyRef.current = null;
            return;
          }

          const answer = getAgentResponse({
            question: buildTourStopQuestion(agent, targetExhibit),
            personality: agent.personality,
            exhibit: targetExhibit,
            nearbyExhibits,
          });
          actions.setAgentDialogue(answer);
          actions.setAgent({
            isAnswering: false,
            currentDialogue: answer,
            memory: {
              ...latest.memory,
              visitedExhibitIds: Array.from(new Set([...latest.memory.visitedExhibitIds, targetExhibit.id])),
            },
          });
          actions.markAgentTourExplained(targetExhibit.id);
          refs.routeWaypointIndexRef.current = 0;
        })
        .finally(() => {
          refs.requestingGuideRef.current = false;
        });
    }
  } else if (agent.mode === "wander") {
    const wanderTarget = refs.lastWanderTargetRef.current;
    if (wanderTarget.distanceTo(current) < AGENT_WANDER_POINT_REACHED) {
      wanderTarget.set(THREE.MathUtils.clamp((Math.random() - 0.5) * ctx.roomSize.width * 0.8, roomMinX, roomMaxX), AGENT_GROUND_Y, THREE.MathUtils.clamp((Math.random() - 0.5) * ctx.roomSize.length * 0.8, roomMinZ, roomMaxZ));
    }
    target.copy(wanderTarget);
    nextMode = "wander";
    nextActiveExhibit = agentNearestExhibit;
    refs.guideTimerRef.current = 0;
  } else {
    nextMode = "idle";
    nextActiveExhibit = agentNearestExhibit;
    refs.guideTimerRef.current = 0;
  }

  target.x = THREE.MathUtils.clamp(target.x, roomMinX, roomMaxX);
  target.z = THREE.MathUtils.clamp(target.z, roomMinZ, roomMaxZ);

  const direction = target.clone().sub(current);
  const distance = direction.length();
  const nextPatch: Partial<AgentState> = {};
  const isMovingMode = nextMode === "follow" || nextMode === "guide" || nextMode === "wander" || nextMode === "tour";

  if (!shouldPreserveMode(agent.mode, nextMode)) nextPatch.mode = nextMode as AgentState["mode"];
  if ((agent.activeExhibit?.id ?? null) !== (nextActiveExhibit?.id ?? null)) actions.setAgentActiveExhibit(nextActiveExhibit);
  nextPatch.targetPosition = [target.x, target.y, target.z] as [number, number, number];

  if (distance > 0.001) {
    direction.normalize();
    const speedMultiplier = nextMode === "guide" ? 0.92 : nextMode === "wander" ? 0.82 : nextMode === "tour" ? 0.84 : 1;
    const movementStep = AGENT_SPEED * speedMultiplier * Math.max(deltaSeconds, 0.008);
    if (isMovingMode) refs.movementAccumulatorRef.current += movementStep;
    const desiredStep = Math.min(distance, Math.max(refs.movementAccumulatorRef.current, movementStep));
    const resolved = resolveAgentStep(current, current.clone().addScaledVector(direction, desiredStep), desiredStep);
    if (!resolved.blocked) {
      refs.movementAccumulatorRef.current = Math.max(0, refs.movementAccumulatorRef.current - desiredStep);
      const smoothing = THREE.MathUtils.clamp(deltaSeconds * 8.5, 0.12, 0.28);
      const blendedPosition = current.clone().lerp(resolved.position, smoothing);
      nextPatch.position = [blendedPosition.x, AGENT_GROUND_Y, blendedPosition.z] as [number, number, number];
      const desiredRotation = Math.atan2(direction.x, direction.z);
      const rotationDelta = Math.atan2(Math.sin(desiredRotation - agent.rotationY), Math.cos(desiredRotation - agent.rotationY));
      nextPatch.rotationY = agent.rotationY + THREE.MathUtils.clamp(rotationDelta, -0.18, 0.18);
    }
  }

  if (Object.keys(nextPatch).length > 0) actions.setAgent(nextPatch);
}
