import OpenAI from 'openai';
import { normalizeSceneGeometry } from './sceneGeometryService.js';
import { sanitizeSceneSnapshot } from '../schemas/sceneSchema.js';
import { buildSceneContext } from './exhibitionSceneContext.js';
import { applySceneOperationPlan, sceneOperationPlanSchema } from './exhibitionSceneOperations.js';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=1200';
const PLACEHOLDER_IMAGES = [
  PLACEHOLDER_IMAGE,
  'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&q=80&w=1200',
  'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&q=80&w=1200',
];

function isBlobUrl(value) {
  return /^blob:\S+$/i.test(value.trim());
}

function findBlobUrlPath(value, path = '$', seen = new WeakSet()) {
  if (typeof value === 'string') {
    return isBlobUrl(value) ? path : null;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return null;

  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findBlobUrlPath(value[index], `${path}[${index}]`, seen);
      if (result) return result;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const keyPath = /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;
    const result = findBlobUrlPath(nestedValue, keyPath, seen);
    if (result) return result;
  }
  return null;
}

export function assertPersistentScenePayload(payload) {
  let scene = payload;
  if (typeof payload === 'string' && !isBlobUrl(payload)) {
    try {
      scene = JSON.parse(payload);
    } catch {
      return;
    }
  }

  const blobUrlPath = findBlobUrlPath(scene);
  if (blobUrlPath) {
    throw new Error(`scene contains a non-persistent blob URL at ${blobUrlPath}`);
  }
}

function getApiKey() {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
}

function getQwenBaseUrl() {
  return (
    process.env.QWEN_BASE_URL ||
    process.env.QWEN_API_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/$/, '');
}

function createQwenClient(apiKey, baseUrl, timeoutMs) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: timeoutMs,
  });
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function roundCoord(value) {
  return Number(Number(value).toFixed(4));
}

function compactWallText(value, maxLineLength = 24, maxLines = 2) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const lines = [];
  let remaining = raw;
  while (remaining && lines.length < maxLines) {
    const chars = Array.from(remaining);
    if (chars.length <= maxLineLength) {
      lines.push(remaining);
      remaining = '';
      break;
    }

    const slice = chars.slice(0, maxLineLength).join('');
    const wordBreak = slice.lastIndexOf(' ');
    if (wordBreak >= Math.floor(maxLineLength * 0.55)) {
      lines.push(slice.slice(0, wordBreak).trim());
      remaining = remaining.slice(wordBreak + 1).trim();
    } else {
      lines.push(slice.trim());
      remaining = chars.slice(maxLineLength).join('').trim();
    }
  }

  if (remaining && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const lastChars = Array.from(lines[lastIndex]);
    lines[lastIndex] = `${lastChars.slice(0, Math.max(0, maxLineLength - 1)).join('').trimEnd()}…`;
  }

  return lines.join('\n');
}

function imageForIndex(index) {
  return PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
}

function wallMount(face, roomSize, axisValue, y = 2.5, offset = 0.2) {
  const halfWidth = roomSize.width / 2;
  const halfLength = roomSize.length / 2;
  if (face === 'east') {
    return {
      position: [roundCoord(halfWidth - offset), y, roundCoord(axisValue)],
      rotation: [0, -Math.PI / 2, 0],
    };
  }
  if (face === 'west') {
    return {
      position: [roundCoord(-halfWidth + offset), y, roundCoord(axisValue)],
      rotation: [0, Math.PI / 2, 0],
    };
  }
  if (face === 'south') {
    return {
      position: [roundCoord(axisValue), y, roundCoord(halfLength - offset)],
      rotation: [0, Math.PI, 0],
    };
  }
  return {
    position: [roundCoord(axisValue), y, roundCoord(-halfLength + offset)],
    rotation: [0, 0, 0],
  };
}

function wallAxisLimit(face, roomSize) {
  return face === 'east' || face === 'west'
    ? roomSize.length / 2 - 2.1
    : roomSize.width / 2 - 2.1;
}

function wallSlotValues(face, roomSize, count) {
  const limit = Math.max(2.8, wallAxisLimit(face, roomSize));
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return roundCoord(-limit + t * limit * 2);
  });
}

function groupExhibitsBySection(plan) {
  const exhibitById = new Map(plan.exhibits.map((exhibit) => [exhibit.id, exhibit]));
  const assigned = new Set();
  const sections = plan.exhibition.sections
    .map((section, index) => {
      const exhibits = (section.exhibitIds || [])
        .map((id) => exhibitById.get(id))
        .filter(Boolean);
      exhibits.forEach((exhibit) => assigned.add(exhibit.id));
      return {
        id: `section-${String(index + 1).padStart(2, '0')}`,
        title: String(section.title || `展區 ${index + 1}`),
        description: String(section.description || ''),
        exhibits,
      };
    })
    .filter((section) => section.exhibits.length > 0);

  const unassigned = plan.exhibits.filter((exhibit) => !assigned.has(exhibit.id));
  if (unassigned.length > 0) {
    sections.push({
      id: `section-${String(sections.length + 1).padStart(2, '0')}`,
      title: sections.length ? '延伸展區' : '主展區',
      description: '補足展覽敘事的作品。',
      exhibits: unassigned,
    });
  }

  if (sections.length === 0) {
    sections.push({
      id: 'section-01',
      title: '主展區',
      description: '',
      exhibits: plan.exhibits,
    });
  }

  return sections;
}

function createBaseRoom({ style, roomShape, roomWidth, roomLength }) {
  const lengthByShape = roomShape === 'long-gallery' ? 30 : roomShape === 'multi-room' ? 28 : 20;
  const width = Math.max(8, Math.min(40, Number(roomWidth) || 24));
  const length = Math.max(8, Math.min(60, Number(roomLength) || lengthByShape));
  const styleSettings = {
    'warm-museum': {
      wallColor: '#f5efe4',
      wallMaterialPreset: 'wood',
      wallTextureUrl: '/textures/wall-wood.svg',
      floorColor: '#3b2f2f',
      environmentBrightness: 0.42,
    },
    'tech-showroom': {
      wallColor: '#1f2937',
      wallMaterialPreset: 'metal',
      wallTextureUrl: '/textures/wall-metal.svg',
      floorColor: '#0b1020',
      environmentBrightness: 0.38,
    },
    'history-gallery': {
      wallColor: '#7f1d1d',
      wallMaterialPreset: 'wood',
      wallTextureUrl: '/textures/wall-wood.svg',
      floorColor: '#422006',
      environmentBrightness: 0.4,
    },
    immersive: {
      wallColor: '#111827',
      wallMaterialPreset: 'paint',
      wallTextureUrl: '/textures/wall-paint.svg',
      floorColor: '#020617',
      environmentBrightness: 0.32,
    },
    'white-box': {},
  }[style || 'white-box'] || {};

  return {
    width,
    length,
    height: 6,
    wallThickness: 0.1,
    wallColor: '#f8fafc',
    wallMaterialPreset: 'paint',
    wallTextureUrl: '/textures/wall-paint.svg',
    wallTextureTiling: 3,
    wallRoughness: 0.35,
    wallMetalness: 0.08,
    wallBumpScale: 0.04,
    wallEnvIntensity: 0.9,
    wallOpacity: 0.98,
    wallTransmission: 0,
    wallIor: 1.45,
    floorColor: '#0f172a',
    floorTextureUrl: '/textures/wall-concrete.svg',
    floorTextureTiling: 2.5,
    floorRoughness: 0.55,
    floorMetalness: 0.18,
    environmentBrightness: 0.45,
    ...styleSettings,
  };
}

function inferTitle(prompt) {
  const cleaned = String(prompt || '').trim().replace(/[。.!?？\n\r].*$/u, '');
  if (!cleaned) return 'AI 生成展覽';
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}展` : `${cleaned}展`;
}

function createFallbackScene(input = {}) {
  const exhibitCount = clampInt(input.exhibitCount, 1, 30, 6);
  const roomSize = createBaseRoom(input);
  const wallZ = -roomSize.length / 2 + 0.06;
  const usableWidth = roomSize.width - 4;
  const spacing = usableWidth / Math.max(1, exhibitCount);
  const title = inferTitle(input.prompt);

  const items = [
    {
      id: 'ai-title',
      type: 'text',
      position: [0, 4.6, wallZ + 0.1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: title,
      textFontFamily: 'sans',
      textColor: '#111827',
      textFontSize: 0.82,
      textIsBold: true,
      textBackboardEnabled: true,
      textBackboardColor: '#ffffff',
    },
  ];

  for (let index = 0; index < exhibitCount; index++) {
    const x = -usableWidth / 2 + spacing * index + spacing / 2;
    const paintingId = `painting-${String(index + 1).padStart(2, '0')}`;
    items.push({
      id: paintingId,
      type: 'painting',
      position: [x, 2.5, wallZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      content: input.assets?.[index]?.imageUrl || imageForIndex(index),
      title: input.assets?.[index]?.title || `展品 ${index + 1}`,
      artist: input.assets?.[index]?.artist || 'AI 策展',
      description: input.assets?.[index]?.description || `這是根據「${input.prompt || '展覽主題'}」自動生成的展品介紹，可由策展人再編輯。`,
      frameWidth: 2.2,
      frameHeight: 1.5,
      externalUrl: '',
    });
    items.push({
      id: `light-${String(index + 1).padStart(2, '0')}`,
      type: 'lightstrip',
      position: [x, 3.55, wallZ + 0.25],
      rotation: [0, 0, 0],
      scale: [2.2, 0.12, 0.12],
      content: '#ffe08a',
      lightIntensity: 0.65,
    });
  }

  items.push(
    { id: 'plant-01', type: 'plant', position: [-roomSize.width / 2 + 1.4, 1.5, roomSize.length / 2 - 1.4], rotation: [0, 0, 0], scale: [1.1, 1.4, 1.1], content: '#22c55e' },
    { id: 'plant-02', type: 'plant', position: [roomSize.width / 2 - 1.4, 1.5, roomSize.length / 2 - 1.4], rotation: [0, 0, 0], scale: [1.1, 1.4, 1.1], content: '#22c55e' },
    { id: 'bench-01', type: 'bench', position: [0, 0.55, 3.4], rotation: [0, 0, 0], scale: [2.4, 1.1, 1], content: '#8b5e3c' },
  );

  return {
    exhibition: {
      title,
      curatorialStatement: `本展以「${input.prompt || 'AI 生成展覽'}」為主題，建立一條可編輯的初始觀展動線。`,
      sections: [
        {
          title: '主展區',
          description: '由 AI 建立的初始展品序列，策展人可再調整內容與位置。',
          exhibitIds: items.filter((item) => item.type === 'painting').map((item) => item.id),
        },
      ],
    },
    scene: {
      roomSize,
      items,
      floorPlanElements: [
        {
          id: 'room-ai-main',
          type: 'room',
          position: [0, 0.02, 0],
          rotation: [0, 0, 0],
          scale: [roomSize.width, 0.04, roomSize.length],
          color: '#dbeafe',
          isLocked: true,
          doorWidth: 1.2,
        },
      ],
      wallMaterialOverrides: {},
    },
  };
}

function createFallbackCuratedScene(input = {}) {
  const exhibitCount = clampInt(input.exhibitCount, 1, 30, 6);
  const title = inferTitle(input.prompt);
  const exhibits = Array.from({ length: exhibitCount }, (_, index) => ({
    id: `painting-${String(index + 1).padStart(2, '0')}`,
    type: 'painting',
    title: input.assets?.[index]?.title || `展品 ${index + 1}`,
    artist: input.assets?.[index]?.artist || 'AI 策展',
    description: input.assets?.[index]?.description || `回應「${input.prompt || 'AI 展覽'}」的第 ${index + 1} 件作品。`,
    imageUrl: input.assets?.[index]?.imageUrl || imageForIndex(index),
  }));
  const sectionCount = Math.min(4, Math.max(1, Math.ceil(exhibitCount / 2)));
  const sectionTitles = ['序章', '轉折', '記憶', '未來'];
  const sections = Array.from({ length: sectionCount }, (_, sectionIndex) => {
    const sectionExhibits = exhibits.filter((_, exhibitIndex) => exhibitIndex % sectionCount === sectionIndex);
    return {
      title: sectionTitles[sectionIndex] || `展區 ${sectionIndex + 1}`,
      description: `以第 ${sectionIndex + 1} 段動線整理展覽主題。`,
      exhibitIds: sectionExhibits.map((exhibit) => exhibit.id),
    };
  });
  const exhibition = {
    title,
    curatorialStatement: `本展覽以「${input.prompt || 'AI 展覽'}」為核心，透過多段牆面分區建立清楚的觀看節奏。`,
    sections,
  };

  return {
    exhibition,
    scene: createCuratedScene(input, { exhibition, exhibits }),
  };
}

function normalizeExhibits(input, rawExhibits = []) {
  const exhibitCount = clampInt(input.exhibitCount, 1, 30, 6);
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const exhibits = Array.isArray(rawExhibits) ? rawExhibits : [];

  return Array.from({ length: exhibitCount }, (_, index) => {
    const source = exhibits[index] && typeof exhibits[index] === 'object' ? exhibits[index] : {};
    const asset = assets[index] || {};
    const id = source.id || asset.id || `painting-${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      type: 'painting',
      title: String(source.title || asset.title || `展品 ${index + 1}`),
      artist: String(source.artist || asset.artist || 'AI 策展'),
      description: String(
        source.description
        || source.label
        || asset.description
        || `此展品回應「${input.prompt || '展覽主題'}」的策展線索。`,
      ),
      imageUrl: source.imageUrl || asset.imageUrl || imageForIndex(index),
    };
  });
}

function normalizeExhibitionPlan(input, parsed = {}) {
  const fallback = createFallbackCuratedScene(input).exhibition;
  const rawExhibition = parsed.exhibition && typeof parsed.exhibition === 'object' ? parsed.exhibition : {};
  const rawExhibits = parsed.exhibits || rawExhibition.exhibits || [];
  const exhibits = normalizeExhibits(input, rawExhibits);
  const exhibitIds = exhibits.map((exhibit) => exhibit.id);
  const title = String(rawExhibition.title || parsed.title || fallback.title).trim() || fallback.title;
  const curatorialStatement = String(
    rawExhibition.curatorialStatement
    || parsed.curatorialStatement
    || fallback.curatorialStatement,
  ).trim();
  const sections = Array.isArray(rawExhibition.sections) && rawExhibition.sections.length > 0
    ? rawExhibition.sections.map((section, index) => ({
      title: String(section?.title || (index === 0 ? '主展區' : `展區 ${index + 1}`)),
      description: String(section?.description || '由 AI 建立的策展段落。'),
      exhibitIds: Array.isArray(section?.exhibitIds) && section.exhibitIds.length > 0 ? section.exhibitIds : exhibitIds,
    }))
    : [{
      title: '主展區',
      description: '依照主題建立的展品序列，策展人可再調整內容與位置。',
      exhibitIds,
    }];

  return {
    exhibition: {
      title,
      curatorialStatement,
      sections,
    },
    exhibits,
  };
}

function sectionSignAxis(face, roomSize, slots, sectionIndex) {
  if (slots.length === 0) return 0;
  const centeredAxis = slots.reduce((sum, value) => sum + value, 0) / slots.length;
  if (face !== 'south') return centeredAxis;

  const limit = wallAxisLimit(face, roomSize);
  if (Math.abs(centeredAxis) >= 3) return centeredAxis;
  if (slots.length > 1) return slots[0];
  return (sectionIndex % 2 === 0 ? -1 : 1) * Math.max(3, limit * 0.55);
}

function createCuratedScene(input = {}, plan = normalizeExhibitionPlan(input)) {
  const roomSize = createBaseRoom(input);
  const sections = groupExhibitsBySection(plan);
  const sectionFaces = ['north', 'east', 'west', 'south'];
  const items = [
    {
      id: 'ai-title',
      type: 'text',
      ...wallMount('south', roomSize, 0, 4.65, 0.16),
      scale: [1, 1, 1],
      content: compactWallText(plan.exhibition.title, 24, 1),
      textFontFamily: 'sans',
      textColor: '#111827',
      textFontSize: 0.72,
      textIsBold: true,
      textBackboardEnabled: true,
      textBackboardColor: '#ffffff',
    },
    {
      id: 'ai-curatorial-statement',
      type: 'text',
      ...wallMount('south', roomSize, 0, 3.65, 0.16),
      scale: [1, 1, 1],
      content: compactWallText(plan.exhibition.curatorialStatement, 28, 3),
      textFontFamily: 'sans',
      textColor: '#334155',
      textFontSize: 0.22,
      textBackboardEnabled: false,
      textBackboardColor: '#f8fafc',
    },
  ];

  sections.forEach((section, sectionIndex) => {
    const face = sectionFaces[sectionIndex % sectionFaces.length];
    const slots = wallSlotValues(face, roomSize, section.exhibits.length);
    const signAxis = sectionSignAxis(face, roomSize, slots, sectionIndex);

    items.push({
      id: `${section.id}-title`,
      type: 'text',
      ...wallMount(face, roomSize, signAxis, 4.1, 0.15),
      scale: [1, 1, 1],
      content: compactWallText(section.title, 22, 1),
      textFontFamily: 'sans',
      textColor: '#111827',
      textFontSize: 0.36,
      textIsBold: true,
      textBackboardEnabled: true,
      textBackboardColor: '#ffffff',
    });

    if (section.description) {
      items.push({
        id: `${section.id}-intro`,
        type: 'text',
        ...wallMount(face, roomSize, signAxis, 3.55, 0.15),
        scale: [1, 1, 1],
        content: compactWallText(section.description, 28, 2),
        textFontFamily: 'sans',
        textColor: '#334155',
        textFontSize: 0.2,
        textBackboardEnabled: true,
        textBackboardColor: '#f8fafc',
      });
    }

    section.exhibits.forEach((exhibit, exhibitIndex) => {
      const globalIndex = plan.exhibits.findIndex((candidate) => candidate.id === exhibit.id);
      const axis = slots[exhibitIndex] ?? 0;
      items.push({
        id: exhibit.id,
        type: 'painting',
        ...wallMount(face, roomSize, axis, 2.55, 0.18),
        scale: [1, 1, 1],
        content: exhibit.imageUrl || imageForIndex(globalIndex < 0 ? exhibitIndex : globalIndex),
        title: exhibit.title,
        artist: exhibit.artist,
        description: exhibit.description,
        frameWidth: 2.1,
        frameHeight: 1.45,
        externalUrl: '',
      });
      items.push({
        id: `label-${String(globalIndex + 1 || exhibitIndex + 1).padStart(2, '0')}`,
        type: 'text',
        ...wallMount(face, roomSize, axis, 1.45, 0.15),
        scale: [1, 1, 1],
        content: compactWallText(exhibit.title, 28, 1),
        textFontFamily: 'sans',
        textColor: '#111827',
        textFontSize: 0.18,
        textIsBold: true,
        textBackboardEnabled: true,
        textBackboardColor: '#ffffff',
      });
      items.push({
        id: `light-${String(globalIndex + 1 || exhibitIndex + 1).padStart(2, '0')}`,
        type: 'lightstrip',
        ...wallMount(face, roomSize, axis, 3.35, 0.45),
        scale: [1.8, 0.12, 0.12],
        content: sectionIndex % 2 === 0 ? '#ffe08a' : '#bae6fd',
        lightIntensity: 0.62,
      });
    });
  });

  items.push(
    { id: 'route-rug-01', type: 'rug', position: [0, 0.01, 0.4], rotation: [0, 0, 0], scale: [5.8, 1, 2.2], content: '#1d4ed8' },
    { id: 'bench-01', type: 'bench', position: [0, 0, 2.6], rotation: [0, Math.PI, 0], scale: [2.4, 1.1, 1], content: '#8b5e3c' },
    { id: 'plant-entrance-left', type: 'plant', position: [-roomSize.width / 2 + 1.4, 0, roomSize.length / 2 - 1.4], rotation: [0, 0, 0], scale: [1.1, 1.4, 1.1], content: '#22c55e' },
    { id: 'plant-entrance-right', type: 'plant', position: [roomSize.width / 2 - 1.4, 0, roomSize.length / 2 - 1.4], rotation: [0, 0, 0], scale: [1.1, 1.4, 1.1], content: '#22c55e' },
  );

  return {
    roomSize,
    items,
    floorPlanElements: [
      {
        id: 'room-ai-main',
        type: 'room',
        position: [0, 0.02, 0],
        rotation: [0, 0, 0],
        scale: [roomSize.width, 0.04, roomSize.length],
        color: '#dbeafe',
        isLocked: true,
        doorWidth: 1.2,
      },
    ],
    wallMaterialOverrides: {},
  };
}

function normalizeCompletionContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
  }
  return String(content || '').trim();
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty Qwen response');
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const json = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Qwen response is not valid JSON');
  }
}

function coerceVec3(value, fallback) {
  if (Array.isArray(value)) {
    const vector = value.slice(0, 3).map((entry) => Number(entry));
    return vector.length === 3 && vector.every(Number.isFinite) ? vector : fallback;
  }
  if (value && typeof value === 'object') {
    const vector = [value.x, value.y, value.z].map((entry) => Number(entry));
    return vector.every(Number.isFinite) ? vector : fallback;
  }
  return fallback;
}

function coerceArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function coerceWallMaterialOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, settings]) => settings && typeof settings === 'object' && !Array.isArray(settings)),
  );
}

function coercePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function _coerceQwenScene(scene, input) {
  const source = scene && typeof scene === 'object' ? scene : {};
  const roomSize = {
    ...createBaseRoom(input),
    ...(source.roomSize && typeof source.roomSize === 'object' ? source.roomSize : {}),
  };

  const items = coerceArray(source.items).map((item, index) => {
    const safeItem = item && typeof item === 'object' ? item : {};
    return {
      ...safeItem,
      id: String(safeItem.id || `ai-item-${String(index + 1).padStart(2, '0')}`),
      type: safeItem.type || 'painting',
      position: coerceVec3(safeItem.position, [0, 2.4, -roomSize.length / 2 + 0.06]),
      rotation: coerceVec3(safeItem.rotation, [0, 0, 0]),
      scale: coerceVec3(safeItem.scale, [1, 1, 1]),
      frameWidth: coercePositiveNumber(safeItem.frameWidth),
      frameHeight: coercePositiveNumber(safeItem.frameHeight),
    };
  });

  const floorPlanElements = coerceArray(source.floorPlanElements).map((element, index) => {
    const safeElement = element && typeof element === 'object' ? element : {};
    return {
      ...safeElement,
      id: String(safeElement.id || `room-${String(index + 1).padStart(2, '0')}`),
      type: safeElement.type || 'room',
      position: coerceVec3(safeElement.position, [0, 0.02, 0]),
      rotation: coerceVec3(safeElement.rotation, [0, 0, 0]),
      scale: coerceVec3(safeElement.scale, [roomSize.width, 0.04, roomSize.length]),
    };
  });

  return {
    roomSize,
    items,
    floorPlanElements,
    wallMaterialOverrides: coerceWallMaterialOverrides(source.wallMaterialOverrides),
  };
}

function shouldReviseExistingScene(input = {}) {
  return Boolean(input.currentScene && Array.isArray(input.currentScene.items) && input.currentScene.items.length > 0);
}

function buildSystemPrompt(input = {}) {
  if (shouldReviseExistingScene(input)) {
    return [
      'You are a precise virtual exhibition editor.',
      'Return valid JSON only. Do not use Markdown. Do not include comments.',
      'The JSON must contain exhibition and operationPlan keys.',
      'Use only operation types and fields present in the output contract.',
      'Only reference item IDs included in sceneContext.',
      'Never replace or remove protected items. Never change content, assetId, assetUrl, thumbnailUrl, or other media fields.',
      'Make the smallest set of operations needed to satisfy the request.',
    ].join(' ');
  }
  return [
    'You are a precise virtual exhibition curator.',
    'Return valid JSON only. Do not use Markdown. Do not include comments.',
    'The JSON must contain exhibition and exhibits keys.',
    'Do not generate 3D coordinates, room geometry, floor plans, or renderer settings.',
    'Preserve named entities, places, topics, and languages from the user request exactly.',
    'Create exactly the requested number of exhibits.',
    'Each exhibit must be specific to the user request, not generic museum filler.',
    'Do not invent real historical authors, dates, or factual claims when the user did not provide them.',
  ].join(' ');
}

function buildPromptAssets(assets) {
  if (!Array.isArray(assets)) return [];
  return assets.slice(0, 30).map((asset) => {
    const imageUrl = typeof asset?.imageUrl === 'string' && !/^(data|blob):/i.test(asset.imageUrl.trim())
      ? asset.imageUrl.slice(0, 500)
      : undefined;
    return {
      id: asset?.id,
      title: asset?.title,
      artist: asset?.artist,
      description: asset?.description,
      ...(imageUrl ? { imageUrl } : {}),
    };
  });
}

function buildUserPrompt(input) {
  const revisionMode = shouldReviseExistingScene(input);
  if (revisionMode) {
    return JSON.stringify({
      mode: 'revise-existing-scene',
      request: input.prompt,
      language: input.language || 'zh-TW',
      sceneContext: buildSceneContext(input.currentScene),
      instructions: [
        'Return the same language as language.',
        'Preserve every protected item and all of its media references.',
        'Do not return a replacement scene, items array, floor plan, or renderer settings.',
        'Use move-item for placement changes and update-item-copy only for title, artist, description, or externalUrl.',
      ],
      outputContract: {
        exhibition: {
          title: 'string',
          curatorialStatement: 'string',
          sections: [{ title: 'string', description: 'string', exhibitIds: ['existing-item-id'] }],
        },
        operationPlan: {
          schemaVersion: 1,
          summary: 'string',
          operations: [{ type: 'allowlisted-operation', itemId: 'existing-item-id' }],
        },
      },
    });
  }
  return JSON.stringify({
    mode: 'create-new-scene',
    request: input.prompt,
    language: input.language || 'zh-TW',
    style: input.style || 'white-box',
    exhibitCount: clampInt(input.exhibitCount, 1, 30, 8),
    roomShape: input.roomShape || 'single-room',
    roomWidth: input.roomWidth || null,
    roomLength: input.roomLength || null,
    assets: buildPromptAssets(input.assets),
    instructions: [
      'Return the same language as language.',
      'Keep the exhibition title anchored to request keywords.',
      'Create exactly exhibitCount exhibits.',
      'For each exhibit, write a concrete title and a 1-2 sentence gallery label.',
      'Use provided assets when available; otherwise use conceptual exhibit titles without claiming real provenance.',
    ],
    outputContract: {
      exhibition: {
        title: 'string',
        curatorialStatement: 'string',
        sections: [{ title: 'string', description: 'string', exhibitIds: ['string'] }],
      },
      exhibits: [
        {
          id: 'painting-01',
          title: 'string',
          artist: 'string',
          description: 'string',
          imageUrl: 'optional URL from provided assets only',
        },
      ],
    },
  });
}

async function callQwenForScene(input) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const client = createQwenClient(apiKey, getQwenBaseUrl(), Number(process.env.QWEN_TIMEOUT_MS || 20000));
  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || 'qwen3.6-plus',
    messages: [
      { role: 'system', content: buildSystemPrompt(input) },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    stream: false,
    temperature: 0.2,
    top_p: 0.9,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });

  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

export async function generateExhibitionScene(input = {}) {
  const fallback = createFallbackCuratedScene(input);
  const revisionMode = shouldReviseExistingScene(input);

  function currentSceneFallback(message) {
    const normalized = normalizeSceneGeometry(sanitizeSceneSnapshot(input.currentScene));
    return {
      exhibition: fallback.exhibition,
      scene: normalized.scene,
      operations: [],
      operationSummary: '',
      warnings: [message, ...normalized.warnings],
      source: 'fallback',
    };
  }

  try {
    const qwenContent = await callQwenForScene(input);
    if (!qwenContent) {
      if (revisionMode) {
        return currentSceneFallback('Qwen scene revision unavailable; kept the existing scene.');
      }
      const normalizedFallback = normalizeSceneGeometry(sanitizeSceneSnapshot(fallback.scene));
      return {
        ...fallback,
        scene: normalizedFallback.scene,
        warnings: normalizedFallback.warnings,
        source: 'fallback',
      };
    }

    const parsed = extractJsonObject(qwenContent);
    if (revisionMode) {
      const operationPlan = sceneOperationPlanSchema.parse(parsed.operationPlan);
      const applied = applySceneOperationPlan(input.currentScene, operationPlan);
      const metadata = normalizeExhibitionPlan(input, parsed).exhibition;
      return {
        exhibition: metadata,
        scene: applied.scene,
        operations: operationPlan.operations,
        operationSummary: operationPlan.summary,
        warnings: applied.warnings,
        source: 'qwen',
      };
    }
    const plan = normalizeExhibitionPlan(input, parsed);
    const exhibition = plan.exhibition;
    const scene = sanitizeSceneSnapshot(createCuratedScene(input, plan));
    const normalized = normalizeSceneGeometry(scene);

    return {
      exhibition,
      scene: normalized.scene,
      warnings: normalized.warnings,
      source: 'qwen',
    };
  } catch {
    if (revisionMode) {
      return currentSceneFallback('Qwen scene revision failed; kept the existing scene.');
    }
    const normalizedFallback = normalizeSceneGeometry(sanitizeSceneSnapshot(fallback.scene));
    return {
      ...fallback,
      scene: normalizedFallback.scene,
      warnings: ['Qwen scene generation failed; used the deterministic fallback.', ...normalizedFallback.warnings],
      source: 'fallback',
    };
  }
}

export const _private = {
  createFallbackScene,
  extractJsonObject,
  buildSystemPrompt,
  buildUserPrompt,
};
