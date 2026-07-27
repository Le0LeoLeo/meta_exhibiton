type SceneItem = Record<string, unknown>;

export interface Scene2DExhibit {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  kind: 'image' | 'video' | 'text' | 'model';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  accessibleText: string;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function mediaUrl(value: unknown, allowVideo = true) {
  const candidate = text(value);
  if (!candidate) return null;

  if (/^(https?:|blob:|\/)/i.test(candidate)) return candidate;
  if (/^data:image\//i.test(candidate)) return candidate;
  if (allowVideo && /^data:video\//i.test(candidate)) return candidate;
  return null;
}

function isVideo(item: SceneItem, source: string | null) {
  const mime = text(item.fileMimeType);
  return Boolean(
    mime?.toLowerCase().startsWith('video/') ||
      source?.toLowerCase().startsWith('data:video/') ||
      source?.toLowerCase().match(/\.(mp4|webm|ogv|ogg)(?:[?#]|$)/),
  );
}

export function sceneToExhibits(snapshot: unknown): Scene2DExhibit[] {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return [];
  const items = (snapshot as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  return items.flatMap((rawItem, index): Scene2DExhibit[] => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return [];
    const item = rawItem as SceneItem;
    const type = text(item.type);
    if (type !== 'painting' && type !== 'sculpture' && type !== 'pedestal' && type !== 'text') return [];

    const content = text(item.content);
    const description = text(item.description) ?? (type === 'text' ? content : null);
    const artist = text(item.artist);
    const title = text(item.title) ?? (type === 'text' ? '展覽文字' : `作品 ${index + 1}`);
    const source = mediaUrl(item.assetUrl) ?? mediaUrl(item.content);
    const video = type === 'painting' && isVideo(item, source);
    const kind = video
      ? 'video'
      : type === 'painting'
        ? 'image'
        : type === 'sculpture' || type === 'pedestal'
          ? 'model'
          : 'text';
    const thumbnail =
      mediaUrl(item.videoThumbnailUrl, false) ??
      mediaUrl(item.thumbnailUrl, false) ??
      (kind === 'image' ? source : null);

    if (kind === 'text' && !description) return [];

    const accessibleText = [title, artist ? `作者：${artist}` : null, description]
      .filter(Boolean)
      .join('。');

    return [{
      id: text(item.id) ?? `exhibit-${index + 1}`,
      title,
      artist,
      description,
      kind,
      mediaUrl: source,
      thumbnailUrl: thumbnail,
      accessibleText,
    }];
  });
}
