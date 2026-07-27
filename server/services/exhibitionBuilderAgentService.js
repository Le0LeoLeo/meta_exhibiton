import crypto from 'node:crypto';
import OpenAI from 'openai';

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
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

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty VL response');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('VL response is not JSON');
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function clampScore(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeIssue(issue = {}, index = 0) {
  const categories = new Set(['geometry', 'layout', 'lighting', 'navigation', 'curation']);
  const severities = new Set(['low', 'medium', 'high']);
  return {
    category: categories.has(issue.category) ? issue.category : 'layout',
    severity: severities.has(issue.severity) ? issue.severity : 'medium',
    viewId: String(issue.viewId || issue.view || `view-${index + 1}`),
    message: String(issue.message || 'The reviewer found a scene quality issue.'),
    suggestedFix: String(issue.suggestedFix || issue.fix || 'Adjust the generated scene and review again.'),
  };
}

function normalizeReviewPayload(payload = {}) {
  const technicalScore = clampScore(payload.technicalScore, 60);
  const curatorialScore = clampScore(payload.curatorialScore, 60);
  const blockingIssues = Array.isArray(payload.blockingIssues)
    ? payload.blockingIssues.map(normalizeIssue)
    : [];
  const hasHighTechnicalIssue = blockingIssues.some(
    (issue) => issue.severity === 'high' && issue.category !== 'curation',
  );
  const overallStatus =
    payload.overallStatus === 'pass' &&
    technicalScore >= 85 &&
    curatorialScore >= 75 &&
    !hasHighTechnicalIssue
      ? 'pass'
      : payload.overallStatus === 'blocked'
        ? 'blocked'
        : 'needs_revision';

  return {
    technicalScore,
    curatorialScore,
    overallStatus,
    blockingIssues,
    viewReviews: Array.isArray(payload.viewReviews)
      ? payload.viewReviews.map((view, index) => ({
          viewId: String(view.viewId || `view-${index + 1}`),
          label: String(view.label || view.viewId || `View ${index + 1}`),
          observations: Array.isArray(view.observations) ? view.observations.map(String) : [],
        }))
      : [],
    revisionPrompt: String(
      payload.revisionPrompt ||
        'Improve geometry, layout, lighting, and curatorial clarity based on the review.',
    ),
  };
}

function isVisionReviewPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    Number.isFinite(Number(payload.technicalScore)) &&
    Number.isFinite(Number(payload.curatorialScore)) &&
    ['pass', 'needs_revision', 'blocked'].includes(payload.overallStatus) &&
    Array.isArray(payload.blockingIssues),
  );
}

const GROUND_ITEM_Y = new Map([
  ['bench', 0],
  ['pedestal', 0],
  ['sculpture', 0],
  ['flower', 0],
  ['rug', 0.01],
  ['vase', 0],
  ['plant', 0],
  ['column', 0],
]);
const GROUND_ITEM_Y_TOLERANCE = 0.02;

function inspectSceneGeometry(scene = {}) {
  const issues = [];
  const roomSize = scene.roomSize || {};
  const halfWidth = Number(roomSize.width || 0) / 2;
  const halfLength = Number(roomSize.length || 0) / 2;
  const wallClearance = 0.3;

  for (const item of Array.isArray(scene.items) ? scene.items : []) {
    const [x = 0, y = 0, z = 0] = Array.isArray(item.position) ? item.position : [];
    const expectedGroundY = GROUND_ITEM_Y.get(item.type);
    if (expectedGroundY !== undefined && Math.abs(y - expectedGroundY) > GROUND_ITEM_Y_TOLERANCE) {
      issues.push({
        category: 'geometry',
        severity: 'high',
        viewId: 'geometry-preflight',
        message: `${item.id || item.type} is not grounded (y=${y}, expected ${expectedGroundY}).`,
        suggestedFix: `Set this floor-standing object to y=${expectedGroundY} before visual review.`,
      });
    }

    if ((item.type === 'painting' || item.type === 'text') && halfWidth > 0 && halfLength > 0) {
      const touchesSideWall = Math.abs(x) > halfWidth - wallClearance;
      const touchesFrontBackWall = Math.abs(z) > halfLength - wallClearance;
      if (touchesSideWall || touchesFrontBackWall) {
        issues.push({
          category: 'geometry',
          severity: 'high',
          viewId: 'geometry-preflight',
          message: `${item.id || item.type} is too close to wall geometry and may clip through the wall.`,
          suggestedFix: 'Move wall-mounted work inward using a larger wall offset before applying the scene.',
        });
      }
    }
  }

  return issues;
}

function wallFaceForPainting(item, roomSize) {
  const [x = 0, , z = 0] = Array.isArray(item.position) ? item.position : [];
  const halfWidth = Number(roomSize.width || 0) / 2;
  const halfLength = Number(roomSize.length || 0) / 2;
  if (halfWidth <= 0 || halfLength <= 0) return 'unknown';
  if (Math.abs(Math.abs(x) - halfWidth) < 0.6) return x > 0 ? 'east' : 'west';
  if (Math.abs(Math.abs(z) - halfLength) < 0.6) return z > 0 ? 'south' : 'north';
  return 'floating';
}

function inspectSceneLayout(scene = {}) {
  const items = Array.isArray(scene.items) ? scene.items : [];
  const paintings = items.filter((item) => item.type === 'painting');
  if (paintings.length < 4) return [];

  const issues = [];
  const wallCounts = new Map();
  for (const painting of paintings) {
    const face = wallFaceForPainting(painting, scene.roomSize || {});
    wallCounts.set(face, (wallCounts.get(face) || 0) + 1);
  }

  const usedWallCount = [...wallCounts.keys()].filter((face) => face !== 'unknown' && face !== 'floating').length;
  const maxWallCount = Math.max(...wallCounts.values());
  if (usedWallCount < Math.min(3, Math.ceil(paintings.length / 3)) || maxWallCount / paintings.length > 0.7) {
    issues.push({
      category: 'layout',
      severity: 'high',
      viewId: 'layout-preflight',
      message: `${paintings.length} exhibits are crowded onto a single wall or too few walls.`,
      suggestedFix: 'Distribute exhibition sections across north, east, west, and south walls with clear route rhythm.',
    });
  }

  const contentCounts = new Map();
  for (const painting of paintings) {
    const key = String(painting.content || painting.assetUrl || painting.thumbnailUrl || '');
    if (!key) continue;
    contentCounts.set(key, (contentCounts.get(key) || 0) + 1);
  }
  const repeatedContentCount = Math.max(0, ...contentCounts.values());
  if (repeatedContentCount >= Math.max(4, Math.ceil(paintings.length * 0.6))) {
    issues.push({
      category: 'curation',
      severity: 'medium',
      viewId: 'curation-preflight',
      message: 'Most exhibit images repeat the same visual placeholder.',
      suggestedFix: 'Use varied placeholder imagery or bind distinct assets so the exhibition reads as curated rather than duplicated.',
    });
  }

  const sectionSigns = items.filter((item) => item.type === 'text' && /^section-\d+-title$/.test(String(item.id || '')));
  if (paintings.length >= 6 && sectionSigns.length < 2) {
    issues.push({
      category: 'curation',
      severity: 'medium',
      viewId: 'curation-preflight',
      message: 'The exhibition lacks visible section signage for a multi-work route.',
      suggestedFix: 'Add section titles and short introductions near each wall group.',
    });
  }

  return issues;
}

function mergeGeometryPreflight(review, scene) {
  const deterministicIssues = [
    ...inspectSceneGeometry(scene),
    ...inspectSceneLayout(scene),
  ];
  if (deterministicIssues.length === 0) return review;
  const hasHighIssue = deterministicIssues.some((issue) => issue.severity === 'high');

  return {
    ...review,
    technicalScore: hasHighIssue ? Math.min(review.technicalScore, 70) : review.technicalScore,
    curatorialScore: Math.min(review.curatorialScore, 78),
    overallStatus: review.overallStatus === 'blocked' ? 'blocked' : 'needs_revision',
    blockingIssues: [...deterministicIssues, ...review.blockingIssues],
    revisionPrompt: [
      'Fix deterministic preflight issues before improving visual details.',
      review.revisionPrompt,
    ].filter(Boolean).join(' '),
  };
}

function createDeterministicPreflightReview(scene) {
  const review = mergeGeometryPreflight({
    technicalScore: 100,
    curatorialScore: 100,
    overallStatus: 'pass',
    blockingIssues: [],
    viewReviews: [],
    revisionPrompt: '',
  }, scene);
  return review.blockingIssues.length > 0 ? review : null;
}

function buildVisionMessages({ screenshots, scene }) {
  const systemPrompt = [
    'You are a vision-language exhibition quality reviewer.',
    'Review only the screenshots and scene metadata provided.',
    'Return valid JSON only.',
    'Score technical quality and curatorial quality separately from 0 to 100.',
    'Flag floating objects, wall intersections, overlaps, blocked paths, unreadable labels, weak lighting, missing multi-room structure, and weak curatorial narrative.',
  ].join(' ');

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        instructions: 'Review these rendered inspection views. Return the requested JSON contract.',
        sceneSummary: {
          roomSize: scene?.roomSize || null,
          itemCount: Array.isArray(scene?.items) ? scene.items.length : 0,
          itemTypes: Array.isArray(scene?.items) ? scene.items.map((item) => item.type) : [],
        },
        outputContract: {
          technicalScore: 0,
          curatorialScore: 0,
          overallStatus: 'pass | needs_revision | blocked',
          blockingIssues: [
            {
              category: 'geometry | layout | lighting | navigation | curation',
              severity: 'low | medium | high',
              viewId: 'string',
              message: 'string',
              suggestedFix: 'string',
            },
          ],
          viewReviews: [{ viewId: 'string', label: 'string', observations: ['string'] }],
          revisionPrompt: 'string',
        },
      }),
    },
    ...screenshots.map((shot) => ({
      type: 'image_url',
      image_url: {
        url: shot.dataUrl,
      },
    })),
  ];

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
}

export async function callQwenVisionReview({
  screenshots,
  scene,
  timeoutMs = Number(process.env.QWEN_TIMEOUT_MS || 30000),
}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('missing Qwen API key');

  const client = new OpenAI({
    apiKey,
    baseURL: getQwenBaseUrl(),
    timeout: timeoutMs,
  });

  const completion = await client.chat.completions.create({
    model: process.env.QWEN_VL_MODEL || process.env.QWEN_VISION_MODEL || 'qwen-vl-max-latest',
    messages: buildVisionMessages({ screenshots, scene }),
    stream: false,
    temperature: 0.2,
    top_p: 0.8,
    enable_search: false,
    enable_thinking: false,
    result_format: 'message',
  });

  return normalizeCompletionContent(completion?.choices?.[0]?.message?.content);
}

export async function createBuilderSession({ input, generateExhibitionScene }) {
  const result = await generateExhibitionScene(input);
  return {
    sessionId: makeId('builder'),
    versionId: makeId('version'),
    exhibition: result.exhibition,
    scene: result.scene,
    source: result.source,
    warnings: result.warnings || [],
    operationSummary: result.operationSummary,
    appliedOperationCount: Array.isArray(result.operations) ? result.operations.length : undefined,
    revisionCount: 0,
    status: 'generated',
  };
}

export async function reviewBuilderSession({
  sessionId,
  versionId,
  scene,
  screenshots,
  callVisionReview = callQwenVisionReview,
}) {
  if (!Array.isArray(screenshots) || screenshots.length < 3) {
    throw new Error('at least 3 screenshots are required for visual review');
  }

  const deterministicReview = createDeterministicPreflightReview(scene);

  try {
    const raw = await callVisionReview({ screenshots, scene });
    let parsed;
    try {
      parsed = extractJsonObject(raw);
      if (!isVisionReviewPayload(parsed)) throw new Error('invalid review contract');
    } catch {
      if (deterministicReview) {
        return {
          sessionId,
          versionId,
          review: deterministicReview,
          status: 'reviewed',
          source: 'fallback',
          errorCode: 'INVALID_VISION_RESPONSE',
          message: 'Visual review was unavailable; local geometry and layout checks found blocking issues.',
        };
      }
      return {
        sessionId,
        versionId,
        review: null,
        status: 'unavailable',
        source: 'fallback',
        errorCode: 'INVALID_VISION_RESPONSE',
        message: 'The visual review provider returned an invalid response.',
      };
    }
    return {
      sessionId,
      versionId,
      review: mergeGeometryPreflight(normalizeReviewPayload(parsed), scene),
      status: 'reviewed',
      source: 'qwen',
    };
  } catch {
    if (deterministicReview) {
      return {
        sessionId,
        versionId,
        review: deterministicReview,
        status: 'reviewed',
        source: 'fallback',
        errorCode: 'VISION_PROVIDER_FAILED',
        message: 'Visual review was unavailable; local geometry and layout checks found blocking issues.',
      };
    }
    return {
      sessionId,
      versionId,
      review: null,
      status: 'unavailable',
      source: 'fallback',
      errorCode: 'VISION_PROVIDER_FAILED',
      message: 'The visual review provider is unavailable.',
    };
  }
}

export async function reviseBuilderSession({
  sessionId,
  scene,
  review,
  prompt = '',
  revisionCount = 0,
  generateExhibitionScene,
}) {
  if (revisionCount >= 3) throw new Error('revision limit reached');

  const issueText = (review?.blockingIssues || [])
    .map((issue) => `${issue.severity} ${issue.category}: ${issue.message} Fix: ${issue.suggestedFix}`)
    .join('\n');

  const revisionPrompt = [
    prompt || 'Revise the generated exhibition scene.',
    review ? 'Use this visual review report to improve the next scene version.' : '',
    review?.revisionPrompt || '',
    issueText,
    'Keep floor objects grounded, wall-mounted works clear of wall geometry, labels readable, and the curatorial route coherent.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await generateExhibitionScene({
    prompt: revisionPrompt,
    exhibitCount: Array.isArray(scene?.items)
      ? Math.max(1, scene.items.filter((item) => item.type === 'painting').length)
      : undefined,
    currentScene: scene,
  });

  return {
    sessionId,
    versionId: makeId('version'),
    exhibition: result.exhibition,
    scene: result.scene,
    source: result.source,
    warnings: result.warnings || [],
    operationSummary: result.operationSummary,
    appliedOperationCount: Array.isArray(result.operations) ? result.operations.length : undefined,
    revisionCount: revisionCount + 1,
    status: 'revised',
  };
}
