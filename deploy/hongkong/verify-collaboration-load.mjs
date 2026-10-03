// Bounded concurrency acceptance. Isolated staging only; never production load.
import assert from 'node:assert/strict';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { readFileSync } from 'node:fs';
assert.equal(process.env.METAEXB_STAGING_ONLY, '1');
const clientCount = Number(process.env.METAEXB_LOAD_CLIENTS || 16);
assert.ok(Number.isInteger(clientCount) && clientCount >= 4 && clientCount <= 32 && clientCount % 2 === 0,
  'METAEXB_LOAD_CLIENTS must be an even integer from 4 to 32');
const rounds = 5;
const itemsPerRoom = clientCount / 2 * rounds;
const broadcastsPerClient = (clientCount / 2 - 1) * rounds;
const p95BudgetMs = 2000;
assert.match((await lookup('metaexb.com')).address, /^(172\.(1[6-9]|2\d|3[01])\.|10\.|192\.168\.)/);
const ca = readFileSync('/tmp/metaexb-staging-root.crt');
const state = JSON.parse(readFileSync('/data/.hk-staging-test-state.json'));
assert.ok(state.prepared);
assert.equal(state.users[0].email, `hk-stage-${state.run}-0@example.invalid`);
async function request(path, method = 'GET', data, token) {
  const payload = data === undefined ? undefined : Buffer.from(JSON.stringify(data));
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'metaexb.com', port: 8443, path, method, ca,
      headers: { Host: 'metaexb.com', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) } }, response => {
      const chunks = []; response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { resolve({ status: response.statusCode, json: JSON.parse(Buffer.concat(chunks)) }); }
        catch (error) { reject(error); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(payload);
  });
}
const login = await request('/api/auth/login', 'POST', { email: state.users[0].email, password: state.users[0].password });
assert.equal(login.status, 200); assert.equal(login.json.user.id, state.users[0].id);
const { createRequire } = await import('node:module');
const { io } = createRequire('/app/package.json')('socket.io-client');
const rooms = [];
for (let index = 0; index < 2; index++) {
  const created = await request('/api/galleries', 'POST', { title: `Concurrent acceptance ${state.run} ${index}`,
    description: 'Synthetic concurrency acceptance', templateTitle: 'Acceptance', templateImage: '/demo/harbour.svg',
    category: 'art', sceneJson: JSON.stringify(state.scene) }, login.json.token);
  assert.equal(created.status, 201); rooms.push(created.json.gallery.id);
}
const clients = []; const timings = []; const violations = [];
function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, receive); reject(new Error(`Timeout: ${name}`)); }, 10_000);
    function receive(payload) { clearTimeout(timeout); resolve(payload); }
    socket.once(name, receive);
  });
}
async function connect(roomId) {
  const socket = io('https://metaexb.com:8443', { autoConnect: false, forceNew: true, transports: ['websocket'],
    reconnection: false, auth: { token: login.json.token }, ca, rejectUnauthorized: true,
    extraHeaders: { Origin: 'https://metaexb.com', Host: 'metaexb.com' } });
  const client = { socket, roomId, operations: [], versions: new Set() }; clients.push(client);
  socket.on('room:error', error => violations.push({ type: 'room-error', code: error.code }));
  socket.on('scene:oped', payload => {
    if (payload.roomId !== roomId) violations.push({ type: 'cross-room' });
    client.operations.push(payload.clientOpId); client.versions.add(payload.version);
  });
  const connected = event(socket, 'connect'); socket.connect(); await connected;
  const joined = event(socket, 'room:joined'); const synced = event(socket, 'scene:synced');
  socket.emit('room:join', { roomId, nickname: 'Synthetic load client' });
  assert.equal((await joined).roomId, roomId); client.snapshot = await synced;
  return client;
}
try {
  await Promise.all(Array.from({ length: clientCount }, (_, index) => connect(rooms[index % 2])));
  for (let round = 0; round < rounds; round++) {
    await Promise.all(clients.map(async (client, index) => {
      const clientOpId = `load-${index}-${round}`;
      const ack = event(client.socket, 'scene:op:ack'); const start = performance.now();
      client.socket.emit('scene:op', { roomId: client.roomId, clientOpId, op: { kind: 'add-item', item: {
        id: clientOpId, type: 'painting', position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], content: '',
      } } });
      const confirmed = await ack; timings.push(performance.now() - start);
      assert.equal(confirmed.clientOpId, clientOpId); assert.equal(confirmed.roomId, client.roomId);
      client.versions.add(confirmed.version);
    }));
  }
  // A request/response barrier follows all operation writes; no arbitrary settle sleep.
  for (const client of clients) {
    const snapshot = event(client.socket, 'scene:synced'); client.socket.emit('scene:request-sync', { roomId: client.roomId });
    const received = await snapshot;
    assert.equal(received.scene.items.filter(item => item.id.startsWith('load-')).length, itemsPerRoom);
    assert.equal(client.operations.length, broadcastsPerClient); assert.equal(new Set(client.operations).size, broadcastsPerClient);
    assert.equal(client.versions.size, itemsPerRoom);
  }
  clients[0].socket.disconnect(); const rejoined = await connect(rooms[0]);
  assert.equal(rejoined.snapshot.scene.items.filter(item => item.id.startsWith('load-')).length, itemsPerRoom);
  assert.deepEqual(violations, []);
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
  assert.ok(p95 <= p95BudgetMs, `p95 acknowledgement ${Math.round(p95)}ms exceeds ${p95BudgetMs}ms acceptance budget`);
  console.log('PASS bounded collaboration load', JSON.stringify({ clients: clientCount, rooms: 2, acceptedOperations: timings.length,
    broadcastsPerClient, p95BudgetMs, p50AckMs: Math.round(timings[Math.floor(timings.length * 0.5)]),
    p95AckMs: Math.round(timings[Math.ceil(timings.length * 0.95) - 1]), maxAckMs: Math.round(timings.at(-1)),
    isolated: true, reconnectVerified: true, productionCapacityClaim: false }));
} finally { for (const client of clients) client.socket.disconnect(); }
