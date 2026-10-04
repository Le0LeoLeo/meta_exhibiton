// Preserve existing box records and media references during the feature's retirement.
export const BOX_SCHEMA = `
CREATE TABLE IF NOT EXISTS box_contents (
 id TEXT PRIMARY KEY, box_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
 asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, UNIQUE(box_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_box_contents_asset ON box_contents(asset_id);
CREATE TABLE IF NOT EXISTS box_operations (
 box_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE, request_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(box_id, request_id)
);
CREATE TABLE IF NOT EXISTS box_events (
 id INTEGER PRIMARY KEY, box_id TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, created_at TEXT NOT NULL
);`;

export function sceneContainsAsset(sceneJson, assetId) {
  try {
    return JSON.parse(sceneJson ?? '{}').items?.some((item) =>
      (item.assetId || /^\/api\/media\/([\w-]+)$/.exec(item.content ?? '')?.[1]) === assetId) === true;
  } catch { return false; }
}
