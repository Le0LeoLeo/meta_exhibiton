// Semantic tools operate in metres on the existing rectangular exhibition room.
// They return scene data only; the existing renderer remains the geometry authority.
export class SpatialToolError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

const fail = (code, message) => { throw new SpatialToolError(code, message); };
const round = (value) => Number(value.toFixed(4));
const faces = ['north', 'west', 'east'];

function assertRectangularRoom(scene) {
  const elements = scene.floorPlanElements || [];
  const rooms = elements.filter((element) => element.type === 'room');
  if (rooms.length > 1 || elements.some((element) => element.type === 'wall')
    || rooms.some((room) => Math.abs(room.position[0]) > 0.01 || Math.abs(room.position[2]) > 0.01
      || room.rotation.some((value) => Math.abs(value) > 0.01)
      || Math.abs(room.scale[0] - scene.roomSize.width) > 0.01 || Math.abs(room.scale[2] - scene.roomSize.length) > 0.01)) {
    fail('UNSUPPORTED_FLOOR_PLAN', 'Wall sections currently require one centred, unrotated rectangular room without custom floor-plan walls.');
  }
}

function wallPose(scene, face, axis, y) {
  const { width, length } = scene.roomSize;
  if (face === 'west') return { position: [-width / 2 + 0.35, y, axis], rotation: [0, Math.PI / 2, 0] };
  if (face === 'east') return { position: [width / 2 - 0.35, y, axis], rotation: [0, -Math.PI / 2, 0] };
  return { position: [axis, y, -length / 2 + 0.35], rotation: [0, 0, 0] };
}

export function textDisplaySize(item) {
  // Match StudioExhibitItem's default font and backboard dimensions; include wrapped text.
  const lines = String(item.content || ' ').split('\n');
  const maxChars = Math.max(1, ...lines.map((line) => Array.from(line).length));
  const font = item.textFontSize ?? 0.42;
  const width = Math.max(1.4, maxChars * font * 0.78 + 0.5);
  const textWidth = Math.max(1.2, width * 0.9);
  const wrappedLines = lines.reduce((count, line) => {
    const emWidth = Array.from(line).reduce((sum, char) => sum + (/[^\u0000-\u007f]/.test(char) ? 1 : 0.65), 0);
    return count + Math.max(1, Math.ceil(emWidth * font / textWidth));
  }, 0);
  return { width, height: Math.max(0.5, wrappedLines * font * 1.35 + 0.32) };
}

function displayBounds(item, scene) {
  const [x, y, z] = item.position;
  let face;
  if (Math.abs(x + scene.roomSize.width / 2) < 0.6) face = 'west';
  else if (Math.abs(x - scene.roomSize.width / 2) < 0.6) face = 'east';
  else if (Math.abs(z + scene.roomSize.length / 2) < 0.6) face = 'north';
  if (!face || !['painting', 'text'].includes(item.type)) return null;
  const sx = Math.abs(item.scale[0]); const sy = Math.abs(item.scale[1]);
  const text = textDisplaySize(item);
  const width = item.type === 'painting' ? (item.frameWidth || 2) + 0.18
    : text.width;
  const height = item.type === 'painting' ? (item.frameHeight || 1.5) + 0.6 : text.height;
  return { id: item.id, face, axis: face === 'north' ? x : z, y: y - (item.type === 'painting' ? 0.2 * sy : 0), width: width * sx, height: height * sy };
}

export function describeExhibitionWalls(scene) {
  return faces.map((face) => ({
    face,
    usableLength: round((face === 'north' ? scene.roomSize.width : scene.roomSize.length) - 2.4),
    occupiedDisplays: scene.items.map((item) => displayBounds(item, scene)).filter((bounds) => bounds?.face === face),
  }));
}

export function arrangeExhibitionSections(scene, { sections, gap = 0.5 }) {
  assertRectangularRoom(scene);
  const ids = sections.flatMap((section) => section.itemIds);
  if (new Set(ids).size !== ids.length || new Set(sections.map((section) => section.wall)).size !== sections.length) {
    fail('DUPLICATE_TARGET', 'Each artwork and wall may occur in only one section.');
  }
  const selected = new Set(ids);
  const signIds = new Set(sections.map((_, index) => `section-${index + 1}-title`));
  for (const item of scene.items.filter((item) => signIds.has(item.id))) {
    if (item.type !== 'text' || item.isLocked) fail('PROTECTED_TARGET', `Cannot replace section sign ${item.id}.`);
  }
  const replacements = new Map();
  const signs = [];
  for (const [index, section] of sections.entries()) {
    const items = section.itemIds.map((id) => {
      const item = scene.items.find((candidate) => candidate.id === id);
      if (!item || item.type !== 'painting') fail('UNKNOWN_ARTWORK', `No painting with ID ${id}.`);
      if (item.isLocked) fail('LOCKED_ARTWORK', `Unlock ${id} before arranging it.`);
      return item;
    });
    const widths = items.map((item) => ((item.frameWidth || 2) + 0.18) * Math.abs(item.scale[0]));
    const required = widths.reduce((sum, width) => sum + width, 0) + gap * (items.length - 1);
    const available = (section.wall === 'north' ? scene.roomSize.width : scene.roomSize.length) - 2.4;
    if (required > available) fail('WALL_CAPACITY', `${section.wall} needs ${round(required)} m; only ${round(available)} m is available. Move works to another section or reduce their display size explicitly.`);
    let y = Math.max(2.2, Math.min(2.5, scene.roomSize.height - 1));
    const reserved = scene.items.filter((item) => !selected.has(item.id) && !signIds.has(item.id))
      .map((item) => displayBounds(item, scene)).filter((bounds) => bounds?.face === section.wall);
    const minY = Math.max(...items.map((item) => 0.3 + 0.2 * Math.abs(item.scale[1]) + ((item.frameHeight || 1.5) + 0.6) * Math.abs(item.scale[1]) / 2));
    for (let candidate = y; candidate >= minY; candidate = round(candidate - 0.1)) {
      let axis = -required / 2;
      const clear = items.every((item, itemIndex) => {
        const moved = { ...item, ...wallPose(scene, section.wall, axis + widths[itemIndex] / 2, candidate) };
        axis += widths[itemIndex] + gap;
        const bounds = displayBounds(moved, scene);
        return reserved.every((other) => Math.abs(bounds.axis - other.axis) >= (bounds.width + other.width) / 2 + 0.1
          || Math.abs(bounds.y - other.y) >= (bounds.height + other.height) / 2 + 0.1);
      });
      if (clear) { y = candidate; break; }
    }
    let cursor = -required / 2;
    let top = 0;
    for (const [itemIndex, item] of items.entries()) {
      const sy = Math.abs(item.scale[1]);
      const halfHeight = ((item.frameHeight || 1.5) + 0.6) * sy / 2;
      if (y - 0.2 * sy - halfHeight < 0.3) fail('VERTICAL_CAPACITY', `${item.id} including its caption extends too close to the floor.`);
      top = Math.max(top, y - 0.2 * sy + halfHeight);
      replacements.set(item.id, { ...item, ...wallPose(scene, section.wall, round(cursor + widths[itemIndex] / 2), y) });
      cursor += widths[itemIndex] + gap;
    }
    const signY = Math.max(4, top + 0.5);
    if (signY + 0.3 > scene.roomSize.height - 0.5) fail('VERTICAL_CAPACITY', `${section.title}: room height cannot fit the artworks and a separate section sign.`);
    signs.push({ id: `section-${index + 1}-title`, type: 'text', content: section.title,
      ...wallPose(scene, section.wall, 0, round(signY)), scale: [1, 1, 1], textFontSize: 0.18,
      textColor: '#202020', textIsBold: true, textBackboardEnabled: true, textBackboardColor: '#ffffff' });
  }
  const retained = scene.items.filter((item) => !signIds.has(item.id)).map((item) => replacements.get(item.id) || item);
  // Keep existing signs intact and find free space for each new heading above its works.
  for (const sign of signs) {
    const initial = displayBounds(sign, scene);
    const occupied = retained.map((item) => displayBounds(item, scene)).filter((bounds) => bounds?.face === initial.face);
    const halfLength = (initial.face === 'north' ? scene.roomSize.width : scene.roomSize.length) / 2 - 1.2;
    const limit = halfLength - initial.width / 2;
    const axes = [0, ...occupied.flatMap((bounds) => [bounds.axis - (bounds.width + initial.width) / 2 - 0.11, bounds.axis + (bounds.width + initial.width) / 2 + 0.11])]
      .filter((axis) => Math.abs(axis) <= limit).sort((a, b) => Math.abs(a) - Math.abs(b));
    const heights = [initial.y, ...occupied.map((bounds) => bounds.y + (bounds.height + initial.height) / 2 + 0.11)]
      .filter((y) => y >= initial.y && y + initial.height / 2 <= scene.roomSize.height - 0.5).sort((a, b) => a - b);
    const spot = heights.flatMap((y) => axes.map((axis) => ({ y, axis }))).find(({ y, axis }) => occupied.every((bounds) =>
      Math.abs(axis - bounds.axis) >= (bounds.width + initial.width) / 2 + 0.1
      || Math.abs(y - bounds.y) >= (bounds.height + initial.height) / 2 + 0.1));
    if (!spot) fail('DISPLAY_OCCUPIED', `No free heading space on ${initial.face}; existing displays were preserved.`);
    Object.assign(sign, wallPose(scene, initial.face, round(spot.axis), round(spot.y)));
    retained.push(sign);
  }
  const result = { ...scene, items: retained };
  const changed = new Set([...selected, ...signIds]);
  const bounds = result.items.map((item) => displayBounds(item, result)).filter(Boolean);
  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i]; const b = bounds[j];
      if (!(changed.has(a.id) || changed.has(b.id)) || a.face !== b.face) continue;
      if (Math.abs(a.axis - b.axis) < (a.width + b.width) / 2 + 0.1 && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 0.1) {
        fail('DISPLAY_OCCUPIED', `${a.id} conflicts with ${b.id} on ${a.face}. Include the existing work in the arrangement or move the obstructing sign explicitly.`);
      }
    }
  }
  return result;
}

export function createExhibitionDivider(scene, { id, atZ, aisleWidth = 2 }) {
  assertRectangularRoom(scene);
  const { width, length, height } = scene.roomSize;
  if (Math.abs(atZ) > length / 2 - 2 || aisleWidth > width - 4) fail('DIVIDER_BOUNDS', 'Divider must remain at least 2 m from front/rear walls and leave space on both sides of the aisle.');
  const segmentLength = (width - aisleWidth) / 2 - 0.6;
  const additions = [-1, 1].map((side) => ({
    id: `${id}-${side < 0 ? 'left' : 'right'}`, type: 'partition', content: '#eeeeee',
    position: [round(side * (aisleWidth / 2 + segmentLength / 2)), height / 2, atZ],
    rotation: [0, 0, 0], scale: [round(segmentLength), height, 0.2],
  }));
  for (const partition of additions) {
    if (scene.items.some((item) => item.id === partition.id)) fail('DUPLICATE_TARGET', `Divider ${partition.id} already exists; remove its generated segments explicitly before rebuilding.`);
    for (const item of scene.items) {
      const halfX = item.type === 'partition' ? Math.abs(item.scale[0]) / 2 : Math.max(0.5, ((item.frameWidth || 2) + 0.18) * Math.abs(item.scale[0]) / 2);
      const halfZ = item.type === 'partition' ? Math.abs(item.scale[2]) / 2 : Math.max(0.5, Math.abs(item.scale[2]));
      // Conservative envelope: refusal is preferable to cutting an existing exhibit.
      const radius = Math.max(halfX, halfZ);
      if (Math.abs(item.position[0] - partition.position[0]) < segmentLength / 2 + radius
        && Math.abs(item.position[2] - atZ) < 0.1 + radius) {
        fail('DIVIDER_OCCUPIED', `${partition.id} would intersect the reserved envelope of ${item.id}; move the divider or exhibit first.`);
      }
    }
  }
  return { ...scene, items: [...scene.items, ...additions] };
}

export function inspectExhibitionDividers(scene) {
  const issues = [];
  for (const item of (scene.items || []).filter((candidate) => candidate.type === 'partition' && /^ai-divider-/.test(candidate.id))) {
    const [x, , z] = item.position;
    const rotated = Math.abs(item.rotation[1]) > 0.01;
    const invalid = rotated || Math.abs(x) - Math.abs(item.scale[0]) / 2 < 0.99
      || Math.abs(x) + Math.abs(item.scale[0]) / 2 > scene.roomSize.width / 2 - 0.3
      || Math.abs(z) + Math.abs(item.scale[2]) / 2 > scene.roomSize.length / 2 - 1.8;
    if (invalid) issues.push({ category: 'navigation', severity: 'high', viewId: 'layout-preflight', resolution: 'automatic',
      message: `${item.id} violates the generated divider boundary or 2 m central aisle.`,
      suggestedFix: 'Remove the generated divider segments and use create-exhibition-divider with valid atZ and aisleWidth; do not rotate these segments.' });
  }
  return issues;
}
