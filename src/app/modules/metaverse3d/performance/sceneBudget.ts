export type SceneBudgetLevel = 'info' | 'warning' | 'critical';

export const SCENE_BUDGET_THRESHOLDS = {
  items: { warning: 80, critical: 160 },
  images: { warning: 40, critical: 80 },
  videos: { warning: 4, critical: 8 },
  models: { warning: 8, critical: 16 },
  floorPlanElements: { warning: 40, critical: 80 },
  lights: { warning: 12, critical: 24 },
} as const;

export type SceneBudgetMetricName = keyof typeof SCENE_BUDGET_THRESHOLDS;

export interface SceneBudgetInput {
  items?: readonly unknown[];
  floorPlanElements?: readonly unknown[];
  lights?: readonly unknown[];
}

export interface SceneBudgetMetric {
  count: number;
  level: SceneBudgetLevel;
}

export interface SceneBudgetResult {
  level: SceneBudgetLevel;
  counts: Record<SceneBudgetMetricName, number>;
  metrics: Record<SceneBudgetMetricName, SceneBudgetMetric>;
  suggestions: string[];
}

type ItemLike = {
  type?: unknown;
  content?: unknown;
  assetUrl?: unknown;
  thumbnailUrl?: unknown;
  videoThumbnailUrl?: unknown;
  fileMimeType?: unknown;
};

const LIGHT_ITEM_TYPES = new Set(['lightstrip', 'spotlight', 'chandelier']);
const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i;
const VIDEO_EXTENSION = /\.(?:m4v|mov|mp4|ogg|webm)(?:[?#]|$)/i;
const MODEL_EXTENSION = /\.(?:glb|gltf|stl)(?:[?#]|$)/i;
const DOCUMENT_EXTENSION = /\.(?:pdf|docx?)(?:[?#]|$)/i;
const ASSET_URL = /^(?:blob:|data:|https?:|\/)/i;
const LEVEL_WEIGHT: Record<SceneBudgetLevel, number> = { info: 0, warning: 1, critical: 2 };

function asItem(value: unknown): ItemLike {
  return value && typeof value === 'object' ? value as ItemLike : {};
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function addAssetUrl(target: Set<string>, value: unknown) {
  const url = asNonEmptyString(value);
  if (!url) return;
  // A signed preview and its published URL refer to the same stored asset.
  target.add(url.replace(/(\/api\/media\/[^/?#]+)(?:\?[^#]*)?(?:#.*)?$/, '$1'));
}

function metricLevel(metric: SceneBudgetMetricName, count: number): SceneBudgetLevel {
  const threshold = SCENE_BUDGET_THRESHOLDS[metric];
  if (count >= threshold.critical) return 'critical';
  if (count >= threshold.warning) return 'warning';
  return 'info';
}

function reductionTarget(metric: SceneBudgetMetricName): number {
  return SCENE_BUDGET_THRESHOLDS[metric].warning - 1;
}

function suggestionFor(metric: SceneBudgetMetricName): string {
  const target = reductionTarget(metric);
  switch (metric) {
    case 'items':
      return `把展品及裝飾減至 ${target} 件以下，重複裝飾可合併或移除。`;
    case 'images':
      return `把獨立圖片減至 ${target} 張以下，並先壓縮至適合螢幕的尺寸。`;
    case 'videos':
      return `把影片減至 ${target} 段以下，停用自動播放並提供靜態封面。`;
    case 'models':
      return `把獨立 3D 模型減至 ${target} 個以下，或加入 LOD 及共用重複模型。`;
    case 'floorPlanElements':
      return `把房間與牆面減至 ${target} 個以下，合併不必要的分隔牆。`;
    case 'lights':
      return `把燈光減至 ${target} 盞以下，優先使用環境光及共用照明。`;
  }
}

export function analyzeSceneBudget(scene: SceneBudgetInput | null | undefined): SceneBudgetResult {
  const items = Array.isArray(scene?.items) ? scene.items : [];
  const floorPlanElements = Array.isArray(scene?.floorPlanElements) ? scene.floorPlanElements : [];
  const explicitLights = Array.isArray(scene?.lights) ? scene.lights : [];
  const imageUrls = new Set<string>();
  const videoUrls = new Set<string>();
  const modelUrls = new Set<string>();
  let itemLightCount = 0;

  for (const rawItem of items) {
    const item = asItem(rawItem);
    const type = asNonEmptyString(item.type)?.toLowerCase() ?? '';
    const mime = asNonEmptyString(item.fileMimeType)?.toLowerCase() ?? '';
    const primaryUrls = [item.content, item.assetUrl]
      .map(asNonEmptyString)
      .filter((value): value is string => Boolean(value));

    if (LIGHT_ITEM_TYPES.has(type)) itemLightCount += 1;

    for (const url of primaryUrls) {
      if (mime.startsWith('image/') || /^data:image\//i.test(url)) addAssetUrl(imageUrls, url);
      else if (mime.startsWith('video/') || /^data:video\//i.test(url)) addAssetUrl(videoUrls, url);
      else if (mime.startsWith('model/')) addAssetUrl(modelUrls, url);
      else if (mime && mime !== 'application/octet-stream') continue;
      else if (VIDEO_EXTENSION.test(url)) addAssetUrl(videoUrls, url);
      else if (MODEL_EXTENSION.test(url) || (type === 'pedestal' && ASSET_URL.test(url))) addAssetUrl(modelUrls, url);
      else if (IMAGE_EXTENSION.test(url)
        || (type === 'painting' && ASSET_URL.test(url) && !DOCUMENT_EXTENSION.test(url))) addAssetUrl(imageUrls, url);
    }

    addAssetUrl(imageUrls, item.thumbnailUrl);
    addAssetUrl(imageUrls, item.videoThumbnailUrl);
  }

  const counts: Record<SceneBudgetMetricName, number> = {
    items: items.length,
    images: imageUrls.size,
    videos: videoUrls.size,
    models: modelUrls.size,
    floorPlanElements: floorPlanElements.length,
    lights: explicitLights.length > 0 ? explicitLights.length : itemLightCount,
  };

  const metrics = Object.fromEntries(
    (Object.keys(counts) as SceneBudgetMetricName[]).map((metric) => [
      metric,
      { count: counts[metric], level: metricLevel(metric, counts[metric]) },
    ]),
  ) as Record<SceneBudgetMetricName, SceneBudgetMetric>;

  const level = (Object.values(metrics) as SceneBudgetMetric[]).reduce<SceneBudgetLevel>(
    (highest, metric) => LEVEL_WEIGHT[metric.level] > LEVEL_WEIGHT[highest] ? metric.level : highest,
    'info',
  );
  const suggestions = (Object.keys(metrics) as SceneBudgetMetricName[])
    .filter((metric) => metrics[metric].level !== 'info')
    .map(suggestionFor);

  return { level, counts, metrics, suggestions };
}
