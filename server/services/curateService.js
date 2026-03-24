import { randomUUID } from 'node:crypto';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseStylePrompt(description) {
  const text = String(description || '').toLowerCase();

  if (text.includes('工業')) {
    return {
      wallMaterialPreset: 'concrete',
      wallColor: '#9ca3af',
      wallTextureUrl: '/textures/wall-concrete.svg',
      wallTextureTiling: 3.5,
      wallRoughness: 0.88,
      wallMetalness: 0.08,
      wallBumpScale: 0.14,
      wallEnvIntensity: 0.22,
      floorColor: '#1f2937',
      floorTextureUrl: '/textures/wall-concrete.svg',
      floorTextureTiling: 3,
      floorRoughness: 0.76,
      floorMetalness: 0.1,
      environmentBrightness: 0.38,
    };
  }

  if (text.includes('未來') || text.includes('科技') || text.includes('霓虹')) {
    return {
      wallMaterialPreset: 'metal',
      wallColor: '#cbd5e1',
      wallTextureUrl: '/textures/wall-metal.svg',
      wallTextureTiling: 4,
      wallRoughness: 0.2,
      wallMetalness: 0.9,
      wallBumpScale: 0.03,
      wallEnvIntensity: 0.95,
      floorColor: '#0f172a',
      floorTextureUrl: '/textures/wall-metal.svg',
      floorTextureTiling: 3,
      floorRoughness: 0.42,
      floorMetalness: 0.36,
      environmentBrightness: 0.56,
    };
  }

  if (text.includes('木') || text.includes('溫暖') || text.includes('北歐') || text.includes('極簡')) {
    return {
      wallMaterialPreset: 'paint',
      wallColor: '#f4f1ea',
      wallTextureUrl: '/textures/wall-paint.svg',
      wallTextureTiling: 2,
      wallRoughness: 0.58,
      wallMetalness: 0.03,
      wallBumpScale: 0.04,
      wallEnvIntensity: 0.45,
      floorColor: '#b08968',
      floorTextureUrl: '/textures/wall-wood.svg',
      floorTextureTiling: 2.5,
      floorRoughness: 0.64,
      floorMetalness: 0.06,
      environmentBrightness: 0.52,
    };
  }

  return {
    wallMaterialPreset: 'paint',
    wallColor: '#dbe7ff',
    wallTextureUrl: '/textures/wall-paint.svg',
    wallTextureTiling: 3,
    wallRoughness: 0.35,
    wallMetalness: 0.08,
    wallBumpScale: 0.04,
    wallEnvIntensity: 0.9,
    floorColor: '#0f172a',
    floorTextureUrl: '/textures/wall-concrete.svg',
    floorTextureTiling: 2.5,
    floorRoughness: 0.55,
    floorMetalness: 0.18,
    environmentBrightness: 0.45,
  };
}

export function buildCuratedScene(description) {
  const text = String(description || '');
  const textLower = text.toLowerCase();
  const style = parseStylePrompt(text);

  const roomSize = {
    width: clamp(textLower.includes('大型') ? 28 : 20, 10, 50),
    length: clamp(textLower.includes('大型') ? 26 : 20, 10, 50),
    height: 6,
    wallThickness: 0.1,
    wallOpacity: 0.98,
    wallTransmission: 0,
    wallIor: 1.45,
    ...style,
  };

  const items = [];

  items.push({
    id: randomUUID(),
    type: 'text',
    position: [0, 4, -9.88],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    content: text.includes('入口') ? '歡迎參觀本次展覽' : '元宇宙策展空間',
    textFontFamily: 'sans',
    textColor: '#111827',
    textFontSize: 0.5,
    textIsBold: true,
  });

  const paintingCount = text.match(/([0-9]+)\s*幅/)?.[1]
    ? clamp(Number(text.match(/([0-9]+)\s*幅/)?.[1] || 4), 2, 12)
    : 4;

  const half = Math.ceil(paintingCount / 2);
  for (let i = 0; i < half; i += 1) {
    items.push({
      id: randomUUID(),
      type: 'painting',
      position: [-9.9, 2, -6 + i * 3.8],
      rotation: [0, Math.PI / 2, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800',
      title: `策展作品 ${i + 1}`,
      artist: 'AI Curator',
      description: text || '由文字策展自動生成的展覽內容。',
      frameWidth: 2,
      frameHeight: 1.5,
    });
  }

  for (let i = 0; i < paintingCount - half; i += 1) {
    items.push({
      id: randomUUID(),
      type: 'painting',
      position: [9.9, 2, -6 + i * 3.8],
      rotation: [0, -Math.PI / 2, 0],
      scale: [1, 1, 1],
      content: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&q=80&w=800',
      title: `策展作品 ${half + i + 1}`,
      artist: 'AI Curator',
      description: text || '由文字策展自動生成的展覽內容。',
      frameWidth: 2,
      frameHeight: 1.5,
    });
  }

  if (text.includes('中央') || text.includes('雕塑')) {
    items.push({
      id: randomUUID(),
      type: 'sculpture',
      position: [0, 0, 0],
      rotation: [0, 0.3, 0],
      scale: [1.4, 1.8, 1.4],
      content: '#e5e7eb',
    });
  }

  if (text.includes('燈條')) {
    items.push({
      id: randomUUID(),
      type: 'lightstrip',
      position: [0, 2.2, -9.9],
      rotation: [0, 0, 0],
      scale: [2.4, 0.12, 0.12],
      content: '#ffe08a',
      lightIntensity: 0.6,
    });
  }

  if (text.includes('霓虹')) {
    items.push({
      id: randomUUID(),
      type: 'neon',
      position: [0, 1.4, 9.7],
      rotation: [0, Math.PI, 0],
      scale: [1.8, 0.8, 0.22],
      content: '#22d3ee',
    });
  }

  const floorPlanElements = [
    {
      id: randomUUID(),
      type: 'room',
      position: [0, 0.02, 0],
      rotation: [0, 0, 0],
      scale: [roomSize.width, 0.04, roomSize.length],
      color: '#dbeafe',
      isLocked: true,
    },
  ];

  return {
    roomSize,
    items,
    floorPlanElements,
    wallMaterialOverrides: {},
  };
}

const ALLOWED_CURATED_ITEM_TYPES = new Set([
  'painting', 'pedestal', 'text', 'partition', 'lightstrip', 'flower', 'chandelier', 'bench',
  'rug', 'vase', 'sculpture', 'spotlight', 'plant', 'column', 'neon',
]);

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toVec3(value, fallback) {
  if (Array.isArray(value) && value.length >= 3) {
    return [toFiniteNumber(value[0], fallback[0]), toFiniteNumber(value[1], fallback[1]), toFiniteNumber(value[2], fallback[2])];
  }
  if (typeof value === 'string') {
    const parts = value.split(',').map((p) => Number(p.trim())).filter((n) => Number.isFinite(n));
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  if (value && typeof value === 'object') {
    const x = toFiniteNumber(value.x, fallback[0]);
    const y = toFiniteNumber(value.y, fallback[1]);
    const z = toFiniteNumber(value.z, fallback[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  return fallback;
}

function toRotationVec3(value, fallback) {
  const rot = toVec3(value, fallback);
  return rot.map((axis) => {
    const abs = Math.abs(axis);
    if (abs > Math.PI * 2 && abs <= 360) return (axis * Math.PI) / 180;
    return axis;
  });
}

function sanitizeCuratedItem(item, fallbackItem, index) {
  const source = item && typeof item === 'object' ? item : {};
  const fallback = fallbackItem && typeof fallbackItem === 'object' ? fallbackItem : {};
  const itemType = typeof source.type === 'string' ? source.type.trim() : '';
  const type = ALLOWED_CURATED_ITEM_TYPES.has(itemType) ? itemType : fallback.type || 'text';
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `curated-item-${index + 1}`;
  const content = typeof source.content === 'string' || typeof source.content === 'number' ? String(source.content) : (fallback.content ?? '');
  return {
    ...fallback,
    ...source,
    id,
    type,
    content,
    position: toVec3(source.position, Array.isArray(fallback.position) ? fallback.position : [0, 1.5, 0]),
    rotation: toRotationVec3(source.rotation, Array.isArray(fallback.rotation) ? fallback.rotation : [0, 0, 0]),
    scale: toVec3(source.scale, Array.isArray(fallback.scale) ? fallback.scale : [1, 1, 1]),
  };
}

function extractJsonObjectString(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1).trim();
  return text;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCuratedSceneShape(scene, description) {
  if (!scene || typeof scene !== 'object') return buildCuratedScene(description);
  const fallback = buildCuratedScene(description);
  const roomSource = scene.roomSize && typeof scene.roomSize === 'object' ? scene.roomSize : {};
  const roomSize = { ...fallback.roomSize, ...roomSource };
  roomSize.width = clamp(toFiniteNumber(roomSize.width, fallback.roomSize.width), 10, 50);
  roomSize.length = clamp(toFiniteNumber(roomSize.length, fallback.roomSize.length), 10, 50);
  roomSize.height = clamp(toFiniteNumber(roomSize.height, fallback.roomSize.height), 3, 15);
  roomSize.wallThickness = clamp(toFiniteNumber(roomSize.wallThickness, fallback.roomSize.wallThickness), 0.1, 2);

  const rawItems = Array.isArray(scene.items) ? scene.items : [];
  const fallbackItems = Array.isArray(fallback.items) ? fallback.items : [];
  const items = (rawItems.length ? rawItems : fallbackItems)
    .slice(0, 80)
    .map((item, index) => sanitizeCuratedItem(item, fallbackItems[index % fallbackItems.length], index));

  const floorPlanElements = Array.isArray(scene.floorPlanElements) ? scene.floorPlanElements : fallback.floorPlanElements;
  const wallMaterialOverrides = scene.wallMaterialOverrides && typeof scene.wallMaterialOverrides === 'object' ? scene.wallMaterialOverrides : {};
  return { roomSize, items, floorPlanElements, wallMaterialOverrides };
}

function distanceXZ(a, b) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function enrichCuratedScene(scene, description) {
  const text = String(description || '').toLowerCase();
  const next = {
    ...scene,
    roomSize: { ...(scene.roomSize || {}) },
    items: Array.isArray(scene.items) ? [...scene.items] : [],
    floorPlanElements: Array.isArray(scene.floorPlanElements) ? [...scene.floorPlanElements] : [],
  };

  const roomWidth = clamp(toFiniteNumber(next.roomSize.width, 20), 10, 50);
  const roomLength = clamp(toFiniteNumber(next.roomSize.length, 20), 10, 50);
  const wallThickness = clamp(toFiniteNumber(next.roomSize.wallThickness, 0.1), 0.1, 2);
  const halfW = roomWidth / 2;
  const halfL = roomLength / 2;
  const wallInset = wallThickness / 2 + 0.06;
  const items = next.items;

  if (!items.some((i) => i?.type === 'text')) {
    items.unshift({ id: `curated-text-${randomUUID()}`, type: 'text', position: [0, 4, -halfL + wallInset], rotation: [0, 0, 0], scale: [1, 1, 1], content: 'Welcome to the curated exhibition', textFontFamily: 'sans', textColor: '#111827', textFontSize: 0.5, textIsBold: true, __wallLocked: true });
  }

  const artLikeCount = items.filter((i) => ['painting', 'sculpture', 'pedestal', 'neon'].includes(i?.type)).length;
  if (artLikeCount < 4) {
    for (let i = 0; i < 4 - artLikeCount; i += 1) {
      const lane = i % 2 === 0 ? -1 : 1;
      items.push({ id: `curated-painting-${randomUUID()}`, type: 'painting', position: [lane * (halfW - wallInset), 2, -3 + i * 3], rotation: [0, lane === -1 ? Math.PI / 2 : -Math.PI / 2, 0], scale: [1, 1, 1], content: 'https://images.unsplash.com/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&q=80&w=800', title: `Curated Piece ${i + 1}`, artist: 'AI Curator', description: String(description || 'AI enhanced exhibition').slice(0, 280), frameWidth: 2, frameHeight: 1.5, __wallLocked: true });
    }
  }

  const validPos = items.filter((i) => Array.isArray(i?.position) && i.position.length >= 3);
  const centerPackedCount = validPos.filter((i) => Math.abs(i.position[0]) < roomWidth * 0.2 && Math.abs(i.position[2]) < roomLength * 0.2).length;
  const looksPackedInCenter = validPos.length > 0 && centerPackedCount / validPos.length >= 0.65;

  const wallArtTypes = new Set(['painting', 'text', 'neon', 'lightstrip']);
  const centerTypes = new Set(['sculpture', 'pedestal', 'bench', 'rug', 'vase', 'flower', 'plant', 'column']);
  const ceilingTypes = new Set(['spotlight', 'chandelier']);

  const wallItems = items.filter((item) => wallArtTypes.has(String(item?.type || '').trim()));
  const wallDistribution = [{ face: 'west', axis: 'z' }, { face: 'east', axis: 'z' }, { face: 'north', axis: 'x' }, { face: 'south', axis: 'x' }];
  const laneCount = wallDistribution.length;
  const basePerLane = Math.floor(wallItems.length / laneCount);
  const remainder = wallItems.length % laneCount;
  let wallCursor = 0;

  for (let lane = 0; lane < laneCount; lane += 1) {
    const laneTargetCount = basePerLane + (lane < remainder ? 1 : 0);
    if (laneTargetCount <= 0) continue;
    const { face, axis } = wallDistribution[lane];
    for (let idx = 0; idx < laneTargetCount; idx += 1) {
      const item = wallItems[wallCursor]; wallCursor += 1; if (!item) continue;
      const t = (idx + 1) / (laneTargetCount + 1);
      const keepY = toFiniteNumber(item.position?.[1], item.type === 'text' ? 4 : 2);
      item.__wallLocked = true;
      if (axis === 'z') {
        const z = -halfL + 1.2 + t * (roomLength - 2.4);
        if (face === 'west') { item.position = [-halfW + wallInset, keepY, z]; item.rotation = [0, Math.PI / 2, 0]; }
        else { item.position = [halfW - wallInset, keepY, z]; item.rotation = [0, -Math.PI / 2, 0]; }
      } else {
        const x = -halfW + 1.2 + t * (roomWidth - 2.4);
        if (face === 'north') { item.position = [x, keepY, -halfL + wallInset]; item.rotation = [0, 0, 0]; }
        else { item.position = [x, keepY, halfL - wallInset]; item.rotation = [0, Math.PI, 0]; }
      }
    }
  }

  let centerIdx = 0; let ceilingIdx = 0;
  const centerCols = Math.max(2, Math.floor(roomWidth / 6));
  const centerStepX = Math.min(4, (roomWidth - 6) / centerCols);
  const centerStepZ = 3.6;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '').trim();
    const hasPosition = Array.isArray(item.position) && item.position.length >= 3;
    const needsRelayout = !hasPosition || looksPackedInCenter || (Math.abs(item.position[0]) < 0.8 && Math.abs(item.position[2]) < 0.8);

    if (ceilingTypes.has(type)) {
      if (!needsRelayout) continue;
      const x = ((ceilingIdx % 3) - 1) * 4;
      const z = Math.floor(ceilingIdx / 3) * 4 - 2;
      item.position = [clamp(x, -halfW + 1.5, halfW - 1.5), 5.2, clamp(z, -halfL + 1.5, halfL - 1.5)];
      item.rotation = [-0.75, 0, 0];
      ceilingIdx += 1;
      continue;
    }

    if (wallArtTypes.has(type)) continue;
    if (!needsRelayout) continue;

    if (centerTypes.has(type)) {
      const col = centerIdx % centerCols;
      const row = Math.floor(centerIdx / centerCols);
      const x = (col - (centerCols - 1) / 2) * centerStepX;
      const z = -2 + row * centerStepZ;
      item.position = [clamp(x, -halfW + 2, halfW - 2), 0, clamp(z, -halfL + 2, halfL - 2)];
      centerIdx += 1;
      continue;
    }

    const angle = centerIdx * 0.85;
    const radius = 2.5 + Math.floor(centerIdx / 6) * 1.6;
    item.position = [clamp(Math.cos(angle) * radius, -halfW + 1.6, halfW - 1.6), toFiniteNumber(item.position?.[1], 1.2), clamp(Math.sin(angle) * radius, -halfL + 1.6, halfL - 1.6)];
    centerIdx += 1;
  }

  const minDistance = text.includes('密集') ? 1.05 : 1.9;
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < items.length; i += 1) {
      const a = items[i]; if (!a?.position) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        const b = items[j]; if (!b?.position) continue;
        const aLocked = Boolean(a.__wallLocked); const bLocked = Boolean(b.__wallLocked);
        if (aLocked && bLocked) continue;
        const dist = distanceXZ(a.position, b.position); if (dist >= minDistance) continue;
        const dx = b.position[0] - a.position[0] || 0.0001;
        const dz = b.position[2] - a.position[2] || 0.0001;
        const len = Math.sqrt(dx * dx + dz * dz);
        const push = (minDistance - dist) * 0.55;
        if (aLocked && !bLocked) {
          b.position = [clamp(b.position[0] + (dx / len) * push, -halfW + 1.2, halfW - 1.2), b.position[1], clamp(b.position[2] + (dz / len) * push, -halfL + 1.2, halfL - 1.2)];
          continue;
        }
        if (!aLocked && bLocked) {
          a.position = [clamp(a.position[0] - (dx / len) * push, -halfW + 1.2, halfW - 1.2), a.position[1], clamp(a.position[2] - (dz / len) * push, -halfL + 1.2, halfL - 1.2)];
          continue;
        }
        b.position = [clamp(b.position[0] + (dx / len) * push, -halfW + 1.2, halfW - 1.2), b.position[1], clamp(b.position[2] + (dz / len) * push, -halfL + 1.2, halfL - 1.2)];
      }
    }
  }

  if (!items.some((i) => i?.type === 'spotlight' || i?.type === 'chandelier')) {
    items.push({ id: `curated-spotlight-${randomUUID()}`, type: 'spotlight', position: [0, 5.2, -1.2], rotation: [-0.7, 0, 0], scale: [1, 1, 1], content: '#fff4d6', lightIntensity: text.includes('劇場') ? 1.1 : 0.85 });
  }

  next.items = items.slice(0, 100);
  return next;
}

export async function generateCuratedSceneWithQwen(description, options = {}) {
  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn('[curate] QWEN_API_KEY / DASHSCOPE_API_KEY not found, using local fallback');
    return null;
  }

  const qualityPresetInput = typeof options.qualityPreset === 'string' ? options.qualityPreset : '';
  const layoutModeInput = typeof options.layoutMode === 'string' ? options.layoutMode : '';
  const qualityPreset = ['cinematic', 'gallery-standard', 'minimal'].includes(qualityPresetInput) ? qualityPresetInput : 'gallery-standard';
  const layoutMode = ['narrative', 'symmetric', 'immersive'].includes(layoutModeInput) ? layoutModeInput : 'narrative';

  const qualityGuide = {
    cinematic: '燈光對比更強、主焦點更明確、前中後景層次更戲劇化。',
    'gallery-standard': '動線清楚、主次分明、易於一般觀眾觀展。',
    minimal: '留白更高、元素更少、更強調單件作品存在感。',
  }[qualityPreset];

  const layoutGuide = {
    narrative: '入口導覽 -> 主展件 -> 延伸展件，形成單向敘事動線。',
    symmetric: '左右牆面與視覺節奏保持對稱均衡。',
    immersive: '中央與周邊共同構成包覆感，觀眾可環形漫遊。',
  }[layoutMode];

  const model = process.env.QWEN_MODEL || 'qwen-max';
  const endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const timeoutMs = clamp(Number(process.env.QWEN_TIMEOUT_MS || 15000), 3000, 60000);
  const maxRetries = clamp(Number(process.env.QWEN_RETRIES || 2), 0, 4);

  const payload = {
    model,
    temperature: qualityPreset === 'minimal' ? 0.42 : 0.52,
    top_p: 0.88,
    enable_thinking: false,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是資深美術館策展總監 + 室內空間規劃師。只能輸出 JSON 物件，不得輸出 markdown、註解或說明文字。JSON 必須包含 roomSize, items, floorPlanElements, wallMaterialOverrides。每個 item 必須包含 id,type,position,rotation,scale,content。position/rotation/scale 必須是數字陣列 [x,y,z]，禁止字串格式。rotation 使用弧度。不可輸出 null、空字串、缺欄位。座標原點在房間中心，必須避免作品互相重疊並維持觀展動線。',
      },
      {
        role: 'user',
        content: `請根據以下需求生成展覽場景 JSON：\n\n【風格主題】\n${description}\n\n【品質預設】\n${qualityPreset}（${qualityGuide}）\n\n【布局模式】\n${layoutMode}（${layoutGuide}）\n\n【硬性限制】\n- roomSize.width/length：10~50\n- roomSize.height：3~15\n- wallThickness：0.1~2\n- item.type 只能使用 painting,pedestal,text,partition,lightstrip,flower,chandelier,bench,rug,vase,sculpture,spotlight,plant,column,neon\n- 入口必須有導覽文字 text\n- 至少 1 件主作品（hero piece）與 2 件陪襯作品\n- 至少 1 組 spotlight 或 chandelier 用於主作品\n- 作品水平最小間距 1.6（若偏密集可 1.1）\n- 物件不得超出房間邊界\n\n【輸出前自我檢查】\n請先在內部檢查：\n1) 每個 item 是否都有合法 position/rotation/scale 陣列\n2) 是否滿足 text + 焦點燈光 + 至少 3 件展品\n3) 是否有重疊或超界\n若不符合請先修正，再輸出最終 JSON。\n\n只回傳 JSON。`,
      },
    ],
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const attemptTimeoutMs = Math.min(timeoutMs + attempt * 5000, 90000);
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        attemptTimeoutMs,
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Qwen API failed: ${response.status} ${errText}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;
      let contentText = '';
      if (typeof rawContent === 'string') contentText = rawContent;
      else if (Array.isArray(rawContent)) {
        contentText = rawContent.map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part.text === 'string') return part.text;
          return '';
        }).join('');
      } else if (rawContent && typeof rawContent === 'object') {
        contentText = JSON.stringify(rawContent);
      }

      const jsonText = extractJsonObjectString(contentText);
      if (!jsonText) throw new Error(`Qwen response content is empty: ${JSON.stringify(data).slice(0, 500)}`);

      const parsed = JSON.parse(jsonText);
      const normalized = normalizeCuratedSceneShape(parsed, description);
      return enrichCuratedScene(normalized, description);
    } catch (err) {
      const isAbort = err?.name === 'AbortError';
      if (isAbort) {
        console.warn(`[curate] qwen request timed out (attempt ${attempt + 1}/${maxRetries + 1})`);
      }
      lastError = err;
      if (attempt === maxRetries) break;
      const backoffMs = isAbort ? 900 * (attempt + 1) : 300 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error(`Qwen request timed out after ${maxRetries + 1} attempt(s). Consider increasing QWEN_TIMEOUT_MS.`);
  }

  throw lastError || new Error('Qwen generation failed for unknown reason');
}
