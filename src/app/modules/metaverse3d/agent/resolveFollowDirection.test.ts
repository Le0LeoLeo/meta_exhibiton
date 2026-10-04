import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveFollowDirection } from "./movementHelpers";

const player = new THREE.Vector3(0, 0, 0);
const forwardFor = (yaw: number) => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
const angleToForward = (direction: THREE.Vector3, yaw: number) => THREE.MathUtils.radToDeg(direction.angleTo(forwardFor(yaw)));

describe("resolveFollowDirection", () => {
  it("moves a guide standing in front of the visitor out to the side", () => {
    const agentInFront = new THREE.Vector3(0.1, 0, -1.3);
    const direction = resolveFollowDirection(player, agentInFront, 0);
    expect(angleToForward(direction, 0)).toBeCloseTo(60, 0);
    // The guide keeps the side it was already on (slightly to the right here).
    expect(direction.x).toBeGreaterThan(0);
  });

  it("respects the visitor's facing direction", () => {
    const yaw = 0.517;
    const agentAhead = player.clone().addScaledVector(forwardFor(yaw), 1.35);
    const direction = resolveFollowDirection(player, agentAhead, yaw);
    expect(angleToForward(direction, yaw)).toBeGreaterThan(50);
  });

  it("leaves a guide that is already beside or behind the visitor where it is", () => {
    const agentBeside = new THREE.Vector3(-1.3, 0, 0);
    expect(resolveFollowDirection(player, agentBeside, 0).toArray()).toEqual([-1, 0, 0]);
    const agentBehind = new THREE.Vector3(0, 0, 1.3);
    expect(resolveFollowDirection(player, agentBehind, 0).toArray()).toEqual([0, 0, 1]);
  });

  it("falls back to the previous behaviour without a yaw", () => {
    const agentInFront = new THREE.Vector3(0, 0, -1.3);
    expect(resolveFollowDirection(player, agentInFront, undefined).toArray()).toEqual([0, 0, -1]);
  });
});
