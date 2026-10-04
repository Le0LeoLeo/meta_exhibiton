function copyObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

export function applySceneOperation(currentScene, op) {
  if (!currentScene || typeof currentScene !== 'object') return null;
  if (!op || typeof op !== 'object') return null;

  const currentSnapshot = structuredClone(currentScene);
  const next = {
    roomSize: currentSnapshot.roomSize,
    items: Array.isArray(currentSnapshot.items) ? [...currentSnapshot.items] : [],
    floorPlanElements: Array.isArray(currentSnapshot.floorPlanElements)
      ? [...currentSnapshot.floorPlanElements]
      : [],
    wallMaterialOverrides: copyObject(currentSnapshot.wallMaterialOverrides),
    updatedAt: Date.now(),
  };

  if (op.kind === 'set-room') {
    next.roomSize = structuredClone(op.roomSize);
  } else if (op.kind === 'set-floor-plan' && Array.isArray(op.floorPlanElements)) {
    next.floorPlanElements = structuredClone(op.floorPlanElements);
  } else if (
    op.kind === 'set-wall-material-overrides'
    && op.wallMaterialOverrides
    && typeof op.wallMaterialOverrides === 'object'
    && !Array.isArray(op.wallMaterialOverrides)
  ) {
    next.wallMaterialOverrides = structuredClone(op.wallMaterialOverrides);
  } else if (op.kind === 'add-item' && op.item && typeof op.item === 'object') {
    next.items.push(structuredClone(op.item));
  } else if (
    op.kind === 'update-item'
    && typeof op.id === 'string'
    && op.updates
    && typeof op.updates === 'object'
    && !Array.isArray(op.updates)
  ) {
    const updates = structuredClone(op.updates);
    next.items = next.items.map((item) => (
      item?.id === op.id ? { ...item, ...updates } : item
    ));
  } else if (op.kind === 'remove-item' && typeof op.id === 'string') {
    next.items = next.items.filter((item) => item?.id !== op.id);
  } else {
    return null;
  }

  return next;
}
