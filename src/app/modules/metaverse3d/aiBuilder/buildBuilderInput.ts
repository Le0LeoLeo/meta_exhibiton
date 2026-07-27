import type { ExhibitionSceneRequest, ExhibitionSceneStyle } from "../../../api/exhibitionScene";
import type { SceneSnapshot } from "../store/metaverseStoreTypes";

export type BuilderFormValues = {
  prompt: string;
  style: ExhibitionSceneStyle;
  exhibitCount: number;
  language?: ExhibitionSceneRequest["language"];
};

function isRequestSafeAssetUrl(value: string | undefined): value is string {
  if (!value) return false;
  return !value.startsWith("blob:") && !value.startsWith("data:");
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
    .filter((asset) => asset.imageUrl);

  return {
    prompt: formValues.prompt.trim(),
    style: formValues.style,
    exhibitCount: formValues.exhibitCount,
    language: formValues.language,
    currentScene: scene,
    assets,
  };
}
