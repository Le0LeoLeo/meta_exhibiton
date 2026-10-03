import { editorWallSurfaces } from './editorFloorGeometry.js';
import { textDisplaySize } from './exhibitionSpatialTools.js';
import { getFloorPlanRoomBounds, getFloorPlanCenter } from './editorFloorGeometry.js';

export function inspectEditorScene(scene) {
  const issues = [];
  if (!scene.roomSize) return issues;
  const add = (message, category = 'geometry') => issues.push({ category, severity: 'high', resolution: 'automatic', viewId: 'editor-preflight', message,
    suggestedFix: 'Use the supplied wall surfaces and actual display sizes. Move or resize the affected objects without removing original works.' });
  const rooms = getFloorPlanRoomBounds(scene.floorPlanElements || [], scene.roomSize.width, scene.roomSize.length);
  const center = getFloorPlanCenter(rooms);
  const surfaces = editorWallSurfaces(scene).map((surface) => ({ ...surface, partition: false }));
  for (const item of scene.items.filter((item) => item.type === 'partition')) for (const side of [0, Math.PI]) surfaces.push({
    id: `${item.id}:${side}`, position: item.position, rotationY: item.rotation[1] + side, size: item.scale.map(Math.abs), partition: true });
  const displays = [];
  for (const item of scene.items) {
    const [x, y, z] = item.position;
    if (!rooms.some((room) => x >= room.minX - center.x - 0.2 && x <= room.maxX - center.x + 0.2 && z >= room.minZ - center.z - 0.2 && z <= room.maxZ - center.z + 0.2)) add(`${item.id} is outside the exhibition floor.`);
    if (!['painting', 'text', 'lightstrip'].includes(item.type)) continue;
    const size = item.type === 'painting' ? { width: (item.frameWidth || 2) + 0.18, height: (item.frameHeight || 1.5) + 0.6 }
      : item.type === 'text' ? textDisplaySize(item) : { width: 1, height: 0.82 };
    const width = size.width * Math.abs(item.scale[0]); const height = size.height * Math.abs(item.scale[1]);
    const displayY = y - (item.type === 'painting' ? 0.2 * Math.abs(item.scale[1]) : 0);
    if (displayY - height / 2 < 0 || displayY + height / 2 > scene.roomSize.height) add(`${item.id} extends beyond floor/ceiling clearance.`);
    let closest;
    for (const wall of surfaces) {
      if (Math.cos(item.rotation[1] - wall.rotationY) < 0.95) continue;
      const nx = Math.sin(wall.rotationY); const nz = Math.cos(wall.rotationY);
      const dx = x - wall.position[0]; const dz = z - wall.position[2];
      const distance = dx * nx + dz * nz;
      const axis = dx * nz - dz * nx;
      if (distance < -0.05 || distance > 0.8 || Math.abs(axis) > wall.size[0] / 2 + width / 2) continue;
      if (!closest || distance < closest.distance) closest = { wall, distance, axis };
    }
    if (!closest) continue; // Floating text/art can be intentional; vision review judges composition.
    const { wall, distance, axis } = closest;
    const depth = (item.type === 'painting' ? 0.1 : item.type === 'text' ? 0.075 : 0.44) * Math.abs(item.scale[2]);
    if (distance < wall.size[2] / 2 + depth - 0.015) add(`${item.id} intersects wall ${wall.id}.`);
    if (Math.abs(axis) + width / 2 > wall.size[0] / 2 + 0.02) add(`${item.id} extends beyond wall ${wall.id}.`);
    displays.push({ id: item.id, wallId: wall.id, axis, y: displayY, width, height });
  }
  for (let i = 0; i < displays.length; i++) for (let j = i + 1; j < displays.length; j++) {
    const a = displays[i]; const b = displays[j];
    if (a.wallId === b.wallId && Math.abs(a.axis - b.axis) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2) add(`${a.id} overlaps ${b.id}, including captions/backboards.`, 'layout');
  }
  return issues;
}
