import { describe, expect, it } from 'vitest';
import { getFloorPlanRoomBounds } from '../store/floorPlanGeometry';
import type { ExhibitItem } from '../types';
import { getVisitorSpawn } from './visitorSpawn';

describe('visitor entrance', () => {
  it('starts inside the reported 8m gallery facing its north-wall artwork', () => {
    const rooms = getFloorPlanRoomBounds([], 8, 8);
    const painting = { id: 'art', type: 'painting', position: [0, 1.5, -3.65], rotation: [0, 0, 0], scale: [1, 1, 1] } as ExhibitItem;
    const spawn = getVisitorSpawn(rooms, [painting], 0.12, 1.4);
    expect(spawn.position).toEqual({ x: 0, y: 1.4, z: 0 });
    expect(spawn.yaw).toBe(0);
  });

  it('centers an offset floor plan and stays clear of thick walls', () => {
    const rooms = [{ id: 'room', isLocked: true, doorOffset: 0, doorWidth: 1.8, minX: 96, maxX: 104, minZ: 196, maxZ: 204 }];
    expect(getVisitorSpawn(rooms, [], 2, 1.4).position).toEqual({ x: 0, y: 1.4, z: 0 });
  });

  it('steps beside the entrance when another visitor is already standing there', () => {
    const rooms = getFloorPlanRoomBounds([], 8, 8);
    const spawn = getVisitorSpawn(rooms, [], 0.12, 1.4, [{ x: 0, z: 0 }]);
    expect(Math.hypot(spawn.position.x, spawn.position.z)).toBeGreaterThanOrEqual(1.39);
    expect(Math.hypot(spawn.position.x, spawn.position.z)).toBeLessThan(2);
  });

  it('does not start inside a central solid pedestal', () => {
    const obstacle = { id: 'pedestal', type: 'pedestal', position: [0, 0, 0], rotation: [0, 0, 0], scale: [2, 2, 2] } as ExhibitItem;
    const spawn = getVisitorSpawn(getFloorPlanRoomBounds([], 8, 8), [obstacle], 0.12, 1.4);
    expect(Math.hypot(spawn.position.x, spawn.position.z)).toBeGreaterThan(1);
    expect(Math.abs(spawn.position.z)).toBeLessThan(3.5);
  });
});
