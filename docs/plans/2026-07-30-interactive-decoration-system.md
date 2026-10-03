# Interactive Decoration System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use subagent-driven development to implement this plan task-by-task.

**Goal:** Add six new exhibition decorations, give every item an explicit collision volume, and provide object-appropriate visitor interactions such as sitting, switching lights, opening cabinets, and starting animated decor.

**Architecture:** Introduce a single item-behavior registry that owns preview size, placement, collision, and interaction metadata for every `ItemType`. Render the new procedural low-poly/PBR decorations through the existing exhibit renderer registry, while the visitor controller consumes the same metadata for collision resolution and contextual actions. Keep visitor toggle/open and sitting state in a dedicated runtime store so visitor actions do not pollute editor history or the persisted exhibition design.

**Tech Stack:** React 18, TypeScript, React Three Fiber, Three.js, Zustand, Vitest.

---

### Task 1: Centralize decoration metadata

**Files:**
- Create: `src/app/modules/metaverse3d/items/itemBehaviorRegistry.ts`
- Create: `src/app/modules/metaverse3d/items/itemBehaviorRegistry.test.ts`
- Modify: `src/app/modules/metaverse3d/types.ts`
- Modify: `src/app/modules/metaverse3d/store/metaverseStoreItemHelpers.ts`
- Modify: `src/app/modules/metaverse3d/components/Room.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/useItemPlacement.ts`

**Steps:**
1. Add `chair`, `sofa`, `floorlamp`, `cabinet`, `turntable`, and `fountain` to `ItemType`.
2. Define exhaustive metadata for every item type: default scale/content, preview box, ground Y, footprint, collider size/offset/solid flag, interaction kind/range/label.
3. Write a test that enumerates all supported item types and asserts every entry has positive collider dimensions.
4. Replace duplicated placement/preview switches with registry access.
5. Run `npm run test -- src/app/modules/metaverse3d/items/itemBehaviorRegistry.test.ts`.

### Task 2: Add editor library entries

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/editorConstants.ts`
- Modify: `src/app/modules/metaverse3d/components/UI/inspectorShared.ts`
- Test: `src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`

**Steps:**
1. Add localized labels and suitable Lucide icons for all six objects.
2. Add default color controls for the new procedural objects.
3. Extend editor tests to assert the new library buttons are available.
4. Run `npm run test -- src/app/modules/metaverse3d/components/UI/EditUI.test.tsx`.

### Task 3: Render six polished decorations

**Files:**
- Modify: `src/app/features/metaverse-studio/exhibits/ExhibitItem.tsx`

**Steps:**
1. Add a dining/lounge chair with a clear seat and back.
2. Add a two-seat sofa.
3. Add a floor lamp whose emissive material and point light follow `interactionState`.
4. Add a cabinet whose doors animate between closed and open.
5. Add a turntable whose record rotates while enabled.
6. Add a fountain with animated water while enabled.
7. Reuse adaptive geometry segment counts and shadow settings.
8. Keep selection outlines and editor transforms consistent with existing items.

### Task 4: Make every item collision-aware

**Files:**
- Create: `src/app/modules/metaverse3d/player/itemCollision.ts`
- Create: `src/app/modules/metaverse3d/player/itemCollision.test.ts`
- Modify: `src/app/modules/metaverse3d/components/Player.tsx`

**Steps:**
1. Convert item metadata plus world position/rotation/scale into oriented XZ colliders with vertical extents.
2. Include every item in collider generation; only resolve movement against colliders marked solid and overlapping the player height.
3. Keep rugs and overhead/wall-mounted items as non-blocking trigger volumes.
4. Test rotated dimensions, scale handling, vertical overlap, and representative floor objects.
5. Run `npm run test -- src/app/modules/metaverse3d/player/itemCollision.test.ts`.

### Task 5: Add contextual visitor interactions

**Files:**
- Create: `src/app/modules/metaverse3d/player/itemInteraction.ts`
- Create: `src/app/modules/metaverse3d/player/itemInteraction.test.ts`
- Modify: `src/app/modules/metaverse3d/input/playerInput.ts`
- Modify: `src/app/modules/metaverse3d/components/Player.tsx`
- Modify: `src/app/modules/metaverse3d/components/ViewCanvas.tsx`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`
- Modify: `src/app/modules/metaverse3d/components/MobileControls.tsx`
- Modify: `src/app/features/metaverse-studio/canvas/StudioCanvasRoot.tsx`

**Steps:**
1. Make desktop `E` generate one interaction request per key press.
2. Resolve the closest actionable item using registry interaction range and collider footprint.
3. Implement seat/stand for bench, chair, and sofa by moving the local camera to a seat anchor and disabling movement until the next interaction.
4. Toggle light state for light strips, chandelier, spotlight, neon, and floor lamp.
5. Toggle cabinet doors, turntable motion, and fountain water.
6. Preserve the existing artwork detail action for exhibit content.
7. Show a desktop `E` prompt and reuse its action label for the mobile interaction button.
8. Add pure helper tests for action selection, labels, seat anchors, and state transitions.

### Task 6: Validate the integrated scene

**Files:**
- Test all modified files.

**Steps:**
1. Run targeted Vitest suites for metadata, collision, input, interaction, exhibit rendering, and editor UI.
2. Run `npm run typecheck`.
3. Run ESLint on modified TypeScript/TSX files.
4. Run `npm run build`.
5. Launch the app and visually verify placement, collision, interaction prompts, sitting camera height, animations, and mobile controls.
