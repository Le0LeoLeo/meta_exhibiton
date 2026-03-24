import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  addPlayer,
  getPlayers,
  normalizeNickname,
  removePlayer,
  updatePlayerMove,
  getRoomScene,
  setRoomScene,
  applyRoomSceneOp,
} from './rooms.js';

const moveRateBySocket = new Map();
const chatRateBySocket = new Map();
const MOVE_RATE_LIMIT_PER_SEC = 25;
const CHAT_RATE_LIMIT_PER_SEC = 3;
const CHAT_MAX_LENGTH = 300;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidMovePayload(payload) {
  return (
    payload &&
    typeof payload.roomId === 'string' &&
    isFiniteNumber(payload.seq) &&
    isFiniteNumber(payload.t) &&
    isFiniteNumber(payload.yaw) &&
    payload.position != null &&
    isFiniteNumber(payload.position.x) &&
    isFiniteNumber(payload.position.y) &&
    isFiniteNumber(payload.position.z)
  );
}

function createRateLimitConsumer(store, limitPerSec) {
  return function consumeRateToken(socketId) {
    const now = Date.now();
    const current = store.get(socketId);
    if (!current || now > current.resetAt) {
      store.set(socketId, { count: 1, resetAt: now + 1000 });
      return true;
    }

    if (current.count >= limitPerSec) {
      return false;
    }

    current.count += 1;
    return true;
  };
}

export function startMultiplayerServer({ initialPort, corsOrigin }) {
  const multiplayerHttpServer = createServer();
  const io = new Server(multiplayerHttpServer, {
    cors: {
      origin: corsOrigin,
      credentials: false,
    },
    transports: ['websocket', 'polling'],
  });

  const consumeMoveToken = createRateLimitConsumer(moveRateBySocket, MOVE_RATE_LIMIT_PER_SEC);
  const consumeChatToken = createRateLimitConsumer(chatRateBySocket, CHAT_RATE_LIMIT_PER_SEC);

  io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('room:join', (payload) => {
      const rawRoomId = typeof payload?.roomId === 'string' ? payload.roomId : 'main-gallery';
      const roomId = rawRoomId.trim() || 'main-gallery';
      const nickname = normalizeNickname(payload?.nickname || '訪客');

      if (currentRoomId && currentRoomId !== roomId) {
        socket.leave(currentRoomId);
        removePlayer(socket.id, currentRoomId);
        socket.to(currentRoomId).emit('player:left', {
          roomId: currentRoomId,
          id: socket.id,
        });
      }

      currentRoomId = roomId;
      socket.join(roomId);

      const existingPlayers = getPlayers(roomId);
      const existing = existingPlayers.find((p) => p.id === socket.id);

      const nextPlayer =
        existing ??
        {
          id: socket.id,
          nickname,
          position: { x: 0, y: 2.6, z: 5 },
          yaw: 0,
          lastSeq: 0,
          updatedAt: Date.now(),
        };

      const snapshot = addPlayer(roomId, {
        ...nextPlayer,
        nickname,
        updatedAt: Date.now(),
      });

      const joinedPayload = {
        selfId: socket.id,
        roomId: snapshot.roomId,
        players: snapshot.players,
      };

      socket.emit('room:joined', joinedPayload);

      const sceneSnapshot = getRoomScene(roomId);
      if (sceneSnapshot) {
        socket.emit('scene:synced', {
          roomId,
          by: 'server',
          scene: {
            roomSize: sceneSnapshot.roomSize,
            items: sceneSnapshot.items,
            floorPlanElements: sceneSnapshot.floorPlanElements,
            wallMaterialOverrides: sceneSnapshot.wallMaterialOverrides,
          },
          updatedAt: sceneSnapshot.updatedAt,
        });
      }

      socket.to(roomId).emit('player:joined', {
        roomId,
        player: snapshot.players.find((p) => p.id === socket.id),
      });
    });

    socket.on('player:move', (payload) => {
      if (!currentRoomId) return;
      if (!isValidMovePayload(payload)) return;
      if (payload.roomId !== currentRoomId) return;
      if (!consumeMoveToken(socket.id)) return;

      const updated = updatePlayerMove(socket.id, payload);
      if (!updated) return;

      const movedPayload = {
        roomId: currentRoomId,
        id: socket.id,
        seq: payload.seq,
        t: payload.t,
        position: updated.position,
        yaw: updated.yaw,
        updatedAt: updated.updatedAt,
      };

      socket.to(currentRoomId).emit('player:moved', movedPayload);
    });

    socket.on('scene:sync', (payload) => {
      if (!currentRoomId) return;
      if (!payload || typeof payload !== 'object') return;
      if (payload.roomId !== currentRoomId) return;
      if (!payload.scene || typeof payload.scene !== 'object') return;

      const snapshot = setRoomScene(currentRoomId, payload.scene);
      if (!snapshot) return;

      socket.to(currentRoomId).emit('scene:synced', {
        roomId: currentRoomId,
        by: socket.id,
        scene: {
          roomSize: snapshot.roomSize,
          items: snapshot.items,
          floorPlanElements: snapshot.floorPlanElements,
          wallMaterialOverrides: snapshot.wallMaterialOverrides,
        },
        updatedAt: snapshot.updatedAt,
      });
    });

    socket.on('scene:op', (payload) => {
      if (!currentRoomId) return;
      if (!payload || typeof payload !== 'object') return;
      if (payload.roomId !== currentRoomId) return;
      if (!payload.op || typeof payload.op !== 'object') return;
      if (typeof payload.clientOpId !== 'string' || !payload.clientOpId.trim()) return;

      const snapshot = applyRoomSceneOp(currentRoomId, payload.op);
      if (!snapshot) return;

      socket.emit('scene:op:ack', {
        roomId: currentRoomId,
        clientOpId: payload.clientOpId,
        updatedAt: snapshot.updatedAt,
      });

      socket.to(currentRoomId).emit('scene:oped', {
        roomId: currentRoomId,
        by: socket.id,
        clientOpId: payload.clientOpId,
        op: payload.op,
        updatedAt: snapshot.updatedAt,
      });
    });

    socket.on('scene:focus', (payload) => {
      if (!currentRoomId) return;
      if (!payload || typeof payload !== 'object') return;
      if (payload.roomId !== currentRoomId) return;

      const itemId = typeof payload.itemId === 'string' && payload.itemId.trim() ? payload.itemId.trim() : null;
      const nickname = typeof payload.nickname === 'string' && payload.nickname.trim() ? payload.nickname.trim() : '協作者';

      socket.to(currentRoomId).emit('scene:focus', {
        roomId: currentRoomId,
        by: socket.id,
        nickname,
        itemId,
        updatedAt: Date.now(),
      });
    });

    socket.on('chat:send', (payload) => {
      if (!currentRoomId) return;
      if (!payload || typeof payload !== 'object') return;
      if (payload.roomId !== currentRoomId) return;
      if (!consumeChatToken(socket.id)) return;

      const nickname = normalizeNickname(payload.nickname || '訪客');
      const message = typeof payload.message === 'string' ? payload.message.trim() : '';
      if (!message) return;

      const clippedMessage = message.slice(0, CHAT_MAX_LENGTH);
      const chatPayload = {
        roomId: currentRoomId,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        by: socket.id,
        nickname,
        message: clippedMessage,
        createdAt: Date.now(),
        type: 'chat',
      };

      io.to(currentRoomId).emit('chat:new', chatPayload);
    });

    socket.on('disconnect', () => {
      moveRateBySocket.delete(socket.id);
      chatRateBySocket.delete(socket.id);
      const removed = removePlayer(socket.id, currentRoomId || undefined);
      if (!removed?.removed) return;

      socket.to(removed.roomId).emit('player:left', {
        roomId: removed.roomId,
        id: socket.id,
      });
    });
  });

  let currentPort = initialPort;

  const start = () => {
    multiplayerHttpServer.listen(currentPort, () => {
      console.log(`[multiplayer] socket server running on :${currentPort}`);
    });
  };

  multiplayerHttpServer.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      const nextPort = currentPort + 1;
      console.warn(
        `[multiplayer] port ${currentPort} is in use, retrying on ${nextPort}...`,
      );
      currentPort = nextPort;
      setTimeout(start, 200);
      return;
    }

    console.error('[multiplayer] failed to start socket server', err);
    process.exit(1);
  });

  start();
}
