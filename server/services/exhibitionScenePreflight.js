import { inspectExhibitionDividers, textDisplaySize } from './exhibitionSpatialTools.js';
import { inspectEditorScene } from './editorScenePreflight.js';

const GROUND_ITEM_Y = new Map([
  ['bench', 0],
  ['pedestal', 0],
  ['sculpture', 0],
  ['flower', 0],
  ['rug', 0.01],
  ['vase', 0],
  ['plant', 0],
  ['column', 0],
  ['chair', 0],
  ['sofa', 0],
  ['floorlamp', 0],
  ['cabinet', 0],
  ['turntable', 0],
  ['fountain', 0],
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
      resolution: 'manual',
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

export function inspectWallClearance(scene = {}) {
  const issues = [];
  const bounds = (scene.items || []).filter((item) => ['painting', 'text'].includes(item.type)).map((item) => {
    const face = wallFaceForPainting(item, scene.roomSize || {});
    const sx = Math.abs(item.scale?.[0] ?? 1);
    const sy = Math.abs(item.scale?.[1] ?? 1);
    const text = textDisplaySize(item);
    const width = item.type === 'painting' ? (item.frameWidth || 2) + 0.18 : text.width;
    const height = item.type === 'painting' ? (item.frameHeight || 1.5) + 0.6 : text.height;
    return { item, face, axis: item.position?.[face === 'east' || face === 'west' ? 2 : 0] || 0,
      y: (item.position?.[1] || 0) - (item.type === 'painting' ? 0.2 * sy : 0), width: width * sx, height: height * sy };
  });
  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = i + 1; j < bounds.length; j += 1) {
      const a = bounds[i]; const b = bounds[j];
      if (a.face === 'unknown' || a.face === 'floating' || a.face !== b.face) continue;
      if (Math.abs(a.axis - b.axis) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2) {
        issues.push({ category: 'layout', severity: 'high', viewId: 'layout-preflight', resolution: 'automatic',
          message: `${a.item.id} and ${b.item.id} have overlapping wall display bounds (including captions).`,
          suggestedFix: 'Move or resize these displays to separate their frames, captions and signs; do not add duplicate painting labels.' });
      }
    }
  }
  return issues;
}

export function mergeGeometryPreflight(review, scene, complete = false) {
  const deterministicIssues = complete ? inspectEditorScene(scene) : [
    ...inspectExhibitionDividers(scene),
    ...inspectSceneGeometry(scene),
    ...inspectSceneLayout(scene),
    ...inspectWallClearance(scene),
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

export function createDeterministicPreflightReview(scene, complete = false) {
  const review = mergeGeometryPreflight({
    technicalScore: 100,
    curatorialScore: 100,
    overallStatus: 'pass',
    blockingIssues: [],
    viewReviews: [],
    revisionPrompt: '',
  }, scene, complete);
  return review.blockingIssues.length > 0 ? review : null;
}
