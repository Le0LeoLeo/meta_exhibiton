import type { BuilderAsset, ExhibitionSceneRequest, ExhibitionSceneStyle } from "../../../api/exhibitionScene";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

export type BuilderFormValues = {
  prompt: string;
  style: ExhibitionSceneStyle;
  exhibitCount: number;
  language?: ExhibitionSceneRequest["language"];
  complete?: boolean;
  allowDestructive?: boolean;
  editorAssets?: BuilderAsset[];
};

function isRequestSafeAssetUrl(value: string | undefined): value is string {
  if (!value) return false;
  if (value.length > 2000 || /[\s\\]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function buildBuilderInput(
  scene: SceneSnapshot,
  formValues: BuilderFormValues,
): ExhibitionSceneRequest {
  const assets = scene.items
    .filter((item) => item.type === "painting")
    .map((item) => {
      const imageUrl = [item.assetUrl, item.thumbnailUrl, item.content].find(isRequestSafeAssetUrl);
      return {
        title: item.title,
        artist: item.artist,
        description: item.description,
        imageUrl,
        type: item.fileMimeType?.startsWith("video/") ? ("video" as const) : ("image" as const),
      };
    })
    .filter((asset) => asset.imageUrl).slice(0, 30);

  return {
    ...(formValues.complete ? { editMode: 'complete' as const, allowDestructive: formValues.allowDestructive ?? false,
      editorAssets: [...(formValues.editorAssets || []), ...scene.items.filter((item) => ['painting', 'pedestal', 'sculpture'].includes(item.type)).flatMap((item): BuilderAsset[] => {
        const url = [item.assetUrl, item.content].find(isRequestSafeAssetUrl);
        return url ? [{ key: `scene:${item.id}`, label: item.title || item.fileName || item.id, url,
          kind: item.type !== 'painting' ? 'model' : item.fileMimeType?.startsWith('video/') ? 'video' : 'image',
          assetId: item.assetId, mimeType: item.fileMimeType, ...(isRequestSafeAssetUrl(item.thumbnailUrl) ? { previewUrl: item.thumbnailUrl } : {}) }] : [];
      })].slice(0, 200) } : {}),
    prompt: formValues.prompt.trim(),
    style: formValues.style,
    exhibitCount: formValues.exhibitCount,
    language: formValues.language,
    currentScene: scene,
    assets,
  };
}
