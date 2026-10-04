// Shared coordinate math used by both manual selection tools and the builder.
export function transformEditorBatch(items, { itemIds, mode, axis = 'x', anchorId, step = 0.5 }) {
  const selected = new Set(itemIds);
  const movable = items.filter((item) => selected.has(item.id) && !item.isLocked);
  const index = { x: 0, y: 1, z: 2 }[axis];
  const anchor = items.find((item) => item.id === anchorId && selected.has(item.id)) || movable[0];
  const sorted = [...movable].sort((a, b) => a.position[index] - b.position[index]);
  const positions = new Map(sorted.map((item, i) => [item.id, sorted.length < 2 ? item.position[index]
    : sorted[0].position[index] + (sorted.at(-1).position[index] - sorted[0].position[index]) * i / (sorted.length - 1)]));
  return items.map((item) => {
    if (!selected.has(item.id) || item.isLocked || !anchor) return item;
    const position = [...item.position];
    if (mode === 'snap') {
      position[0] = Math.round(position[0] / step) * step;
      position[2] = Math.round(position[2] / step) * step;
    } else position[index] = mode === 'align' ? anchor.position[index] : positions.get(item.id);
    return position.every((value, i) => value === item.position[i]) ? item : { ...item, position };
  });
}
