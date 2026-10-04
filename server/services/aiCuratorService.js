import OpenAI from 'openai';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen3.6-plus';
const DEFAULT_TIMEOUT_MS = 15000;
const FALLBACK_WARNING = 'AI curator fallback used because no API key is configured.';
const ALLOWED_MEDIA = new Set(['image', 'text', 'model', 'video', 'mixed']);
const ALLOWED_PLACEMENT_HINTS = ['left-wall', 'right-wall', 'back-wall', 'center'];
const DEFAULT_INTENT = 'warm-memory';
const INTENT_INSTRUCTIONS = {
  'warm-memory': 'Use a warm, memory-led tone that connects people, places, and lived experience without becoming sentimental.',
  'professional-gallery': 'Use a precise gallery tone with clear sections, concise labels, and a calm visitor flow.',
};

function getApiKey() {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
}

function getQwenBaseUrl() {
  return (
    process.env.QWEN_BASE_URL ||
    process.env.QWEN_API_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/$/, '');
}

function createQwenClient(apiKey, baseUrl, timeoutMs) {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: timeoutMs,
  });
}

function stringValue(value, fallback = '') {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function slugify(value, fallback) {
  const slug = stringValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function uniqueId(value, fallback, usedIds) {
  const baseId = slugify(value, fallback);
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeCompletionContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text || '';
        return part?.text || '';
      })
      .join('')
      .trim();
  }
  return String(content || '').trim();
}

function clampExhibitCount(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(3, Math.min(12, parsed));
}

function normalizeIntent(value) {
  return Object.prototype.hasOwnProperty.call(INTENT_INSTRUCTIONS, value)
    ? value
    : DEFAULT_INTENT;
}

function createSection(theme, index, raw = {}, usedIds) {
  const title = stringValue(raw.title, `${theme} Chapter ${index + 1}`);
  const fallbackId = `section-${index + 1}`;
  return {
    id: usedIds
      ? uniqueId(raw.id || title, fallbackId, usedIds)
      : slugify(raw.id || title, fallbackId),
    title,
    summary: stringValue(raw.summary || raw.description, `A focused gallery section exploring ${theme}.`),
  };
}

function createExhibit(theme, index, section, raw = {}, usedIds) {
  const title = stringValue(raw.title, `${theme} Exhibit ${index + 1}`);
  const medium = ALLOWED_MEDIA.has(raw.medium) ? raw.medium : 'mixed';
  const placementHint = ALLOWED_PLACEMENT_HINTS.includes(raw.placementHint)
    ? raw.placementHint
    : ALLOWED_PLACEMENT_HINTS[index % ALLOWED_PLACEMENT_HINTS.length];
  const fallbackId = `exhibit-${index + 1}`;
  return {
    id: usedIds
      ? uniqueId(raw.id || title, fallbackId, usedIds)
      : slugify(raw.id || title, fallbackId),
    sectionId: section.id,
    title,
    description: stringValue(raw.description || raw.summary, `A curated work that develops the ${theme} narrative.`),
    medium,
    placementHint,
  };
}

function createFallbackPlan(input = {}, warnings = [FALLBACK_WARNING]) {
  const intent = normalizeIntent(input.intent);
  const theme = stringValue(input.theme || input.prompt || input.title, 'Untitled Exhibition');
  const exhibitCount = clampExhibitCount(input.exhibitCount ?? input.count);
  const sections = [
    createSection(theme, 0, {
      id: 'opening',
      title: `${theme} Origins`,
      summary: `Introduces the core ideas and atmosphere of ${theme}.`,
    }),
    createSection(theme, 1, {
      id: 'dialogue',
      title: `${theme} Dialogues`,
      summary: `Connects contrasting materials, perspectives, and visitor questions around ${theme}.`,
    }),
    createSection(theme, 2, {
      id: 'reflection',
      title: `${theme} Reflections`,
      summary: `Closes with reflective works that extend ${theme} into lived experience.`,
    }),
  ];

  const exhibits = Array.from({ length: exhibitCount }, (_, index) => {
    const section = sections[index % sections.length];
    return createExhibit(theme, index, section, {
      id: `exhibit-${index + 1}`,
      title: `${theme} Study ${index + 1}`,
      medium: index % 3 === 1 ? 'text' : index % 3 === 2 ? 'model' : 'image',
    });
  });

  return {
    source: 'fallback',
    exhibition: {
      title: `${theme} Curated Exhibition`,
      introduction: intent === 'warm-memory'
        ? `A guided exhibition plan for ${theme}, arranged as a warm memory-led journey through people, places, and lived experience.`
        : `A guided exhibition plan for ${theme}, arranged for a balanced virtual gallery experience.`,
      guideOpening: `Welcome to ${theme}. Move through each section as a connected story rather than a checklist.`,
      sections,
      exhibits,
    },
    warnings,
  };
}

function extractJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in model response.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(source.slice(start, index + 1));
      }
    }
  }

  throw new Error('Unterminated JSON object in model response.');
}

function normalizeRawSections(rawSections, theme) {
  const sourceSections = Array.isArray(rawSections) ? rawSections.filter(Boolean) : [];
  const sectionCount = Math.max(3, Math.min(5, sourceSections.length || 3));
  const usedSectionIds = new Set();
  return Array.from({ length: sectionCount }, (_, index) => (
    createSection(theme, index, sourceSections[index] || {}, usedSectionIds)
  ));
}

function normalizeCuratorPlan(rawPlan = {}, input = {}) {
  const theme = stringValue(
    input.theme ||
      input.prompt ||
      rawPlan?.exhibition?.title ||
      rawPlan?.title,
    'Untitled Exhibition',
  );
  const requestedCount = clampExhibitCount(input.exhibitCount ?? input.count);
  const rawExhibition = rawPlan?.exhibition && typeof rawPlan.exhibition === 'object'
    ? rawPlan.exhibition
    : rawPlan;
  const sections = normalizeRawSections(rawExhibition?.sections, theme);
  const sourceExhibits = Array.isArray(rawExhibition?.exhibits)
    ? rawExhibition.exhibits.filter(Boolean)
    : Array.isArray(rawPlan?.exhibits)
      ? rawPlan.exhibits.filter(Boolean)
      : [];

  const usedExhibitIds = new Set();
  const exhibits = Array.from({ length: requestedCount }, (_, index) => {
    const raw = sourceExhibits[index] || sourceExhibits[index % Math.max(1, sourceExhibits.length)] || {};
    const requestedSectionId = stringValue(raw.sectionId);
    const section = sections.find((item) => item.id === requestedSectionId) || sections[index % sections.length];
    return createExhibit(theme, index, section, raw, usedExhibitIds);
  });

  return {
    source: 'qwen',
    exhibition: {
      title: stringValue(rawExhibition?.title, `${theme} Curated Exhibition`),
      introduction: stringValue(
        rawExhibition?.introduction || rawExhibition?.curatorialStatement,
        `A guided exhibition plan for ${theme}.`,
      ),
      guideOpening: stringValue(
        rawExhibition?.guideOpening || rawExhibition?.opening,
        `Welcome to ${theme}. Begin with the opening section and follow the narrative flow.`,
      ),
      sections,
      exhibits,
    },
    warnings: [],
  };
}

function buildCuratorMessages(input, exhibitCount) {
  const theme = stringValue(input.theme || input.prompt || input.title, 'Untitled Exhibition');
  const language = stringValue(input.language, 'English');
  const intent = normalizeIntent(input.intent);
  const intentInstruction = INTENT_INSTRUCTIONS[intent];
  return [
    {
      role: 'system',
      content: [
        'You are an expert virtual exhibition curator.',
        'Return only one valid JSON object.',
        'Do not include Markdown, commentary, or 3D coordinates.',
        'Use this exact top-level shape: {"exhibition":{"title":"","introduction":"","guideOpening":"","sections":[],"exhibits":[]}}.',
        'Sections must include id, title, summary. Exhibits must include id, sectionId, title, description, medium, placementHint.',
        'Allowed medium values: image, text, model, video, mixed.',
        'Allowed placementHint values: left-wall, right-wall, back-wall, center.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Theme: ${theme}`,
        `Language: ${language}`,
        `Exhibit count: ${exhibitCount}`,
        `Curatorial intent: ${intent}`,
        `Intent instruction: ${intentInstruction}`,
        'Create 3 to 5 sections and exactly the requested number of exhibits.',
        'Focus on curatorial story, visitor flow, and wall/pedestal placement hints only.',
      ].join('\n'),
    },
  ];
}

async function callQwenCurator(input, exhibitCount) {
  const apiKey = getApiKey();
  const baseUrl = getQwenBaseUrl();
  const timeoutMs = Number(process.env.QWEN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const client = createQwenClient(apiKey, baseUrl, timeoutMs);
  const completion = await client.chat.completions.create({
    model: process.env.QWEN_MODEL || DEFAULT_MODEL,
    messages: buildCuratorMessages(input, exhibitCount),
    stream: false,
    top_p: 0.85,
    temperature: 0.65,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });

  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

export async function generateCuratorPlan(input = {}) {
  const exhibitCount = clampExhibitCount(input.exhibitCount ?? input.count);
  if (!getApiKey()) {
    return createFallbackPlan({ ...input, exhibitCount });
  }

  try {
    const content = await callQwenCurator(input, exhibitCount);
    if (!content) {
      throw new Error('empty model response');
    }
    const rawPlan = extractJsonObject(content);
    return normalizeCuratorPlan(rawPlan, { ...input, exhibitCount });
  } catch (error) {
    return createFallbackPlan(
      { ...input, exhibitCount },
      [`AI curator generation failed: ${error?.message || 'unknown error'}`],
    );
  }
}

export const _private = {
  buildCuratorMessages,
  clampExhibitCount,
  createFallbackPlan,
  extractJsonObject,
  normalizeIntent,
  normalizeCuratorPlan,
};
