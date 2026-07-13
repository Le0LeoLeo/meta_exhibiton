# Multiplayer Scene Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve all collaborative scene edits and synchronize floor-plan and wall-material changes.

**Architecture:** Extend the scene-operation protocol with atomic floor-plan and wall-material replacement operations. Queue inbound scene operations in the client store so bursts from Socket.IO are applied in order.

**Tech Stack:** React, Zustand, Socket.IO, Express, Vitest.

---

### Task 1: Extend scene operations

**Files:**
- Modify: `src/app/modules/metaverse3d/network/protocol.ts`
- Modify: `server/multiplayer/rooms.js`
- Modify: `server/multiplayer/socketServer.js`
- Test: `server/multiplayer/socketServer.test.js`

1. Add validated operations for floor-plan elements and wall-material overrides.
2. Apply them atomically to the server room snapshot.
3. Verify editors receive acknowledgements and observers receive the operation.

### Task 2: Preserve inbound operation bursts

**Files:**
- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.ts`
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.tsx`

1. Store incoming scene operations as a FIFO queue.
2. Dequeue each operation only after it has been applied to the editor scene.
3. Emit the new operation types when their exported scene data changes.

### Task 3: Validate

**Files:**
- Test: `server/multiplayer/socketServer.test.js`
- Test: `src/app/modules/metaverse3d/components/Multiplayer/MultiplayerBridge.test.tsx`

1. Run the focused multiplayer server and bridge tests.
2. Run the TypeScript build/check if the focused tests pass.
