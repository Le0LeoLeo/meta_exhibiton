import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildAutomaticExhibition } from "../../../../../server/services/automaticExhibitionLayout.js";
import { sanitizeSceneSnapshot } from "../../../../../server/schemas/sceneSchema.js";
import {
  addMediaShareTokenToScene,
  stripMediaAccessTokensFromScene,
} from "@/app/features/exhibition-wizard/mediaSceneUrls";
import type { SceneSnapshot } from "./metaverseStoreTypes";
import { sanitizeItemsForPersist } from "./metaverseStoreUtils";
import { useMetaverseStudioStore } from "./useMetaverseStudioStore";

function createAutomaticScene(): SceneSnapshot {
  return buildAutomaticExhibition({
    language: "en",
    style: "white-box",
    assets: [[1600, 900], [900, 1600], [1000, 1000], [10000, 1], [1, 10000]].map(([width, height], order) => ({
      assetId: `00000000-0000-4000-8000-${String(order + 1).padStart(12, "0")}`,
      order, width, height,
      fileName: `Artwork ${order + 1}.png`,
      mimeType: "image/png",
      title: `Artwork ${order + 1}`,
      artist: "Provided artist",
      description: "Provided description",
    })),
  }).scene;
}

describe("automatic artwork scene round trips", () => {
  const initialState = useMetaverseStudioStore.getState();

  beforeEach(() => {
    useMetaverseStudioStore.setState({
      ...initialState,
      mode: "edit",
      items: [],
      selectedItemId: null,
      selectedItemIds: [],
      undoStack: [],
      redoStack: [],
    });
  });

  afterEach(() => useMetaverseStudioStore.setState(initialState, true));

  it.each(["importScene", "syncSceneSnapshot"] as const)("preserves automatic artwork through %s, editing, undo/redo and JSON re-import", (action) => {
    const source = createAutomaticScene();
    const store = useMetaverseStudioStore.getState();
    store[action](JSON.parse(JSON.stringify(source)));
    expect(store.exportScene().items).toEqual(source.items);

    store.updateItem(source.items[0].id, { title: "Edited title", frameWidth: 1.3 });
    const edited = store.exportScene();
    expect(edited.items[0]).toEqual({ ...source.items[0], title: "Edited title", frameWidth: 1.3 });

    store.undo();
    expect(store.exportScene().items).toEqual(source.items);
    store.undo();
    expect(store.exportScene().items).toEqual([]);
    store.redo();
    expect(store.exportScene().items).toEqual(source.items);
    store.redo();
    expect(store.exportScene().items).toEqual(edited.items);

    const persisted = {
      ...edited,
      items: sanitizeItemsForPersist(edited.items),
    };
    // Persistence represents absent external/video URLs as empty strings.
    const expectedPersistedItems = edited.items.map((item) => ({
      ...item, externalUrl: "", videoThumbnailUrl: "",
    }));
    const restored = sanitizeSceneSnapshot(JSON.parse(JSON.stringify(persisted)));
    expect(restored.items).toEqual(expectedPersistedItems);
    store[action](restored);
    expect(store.exportScene().items).toEqual(expectedPersistedItems);

    // Export returns an isolated copy rather than an alias into the editor/history.
    const exported = store.exportScene();
    exported.items[0].assetId = "changed-outside-the-editor";
    exported.items[0].imageAspectRatio = 42;
    expect(store.exportScene().items).toEqual(expectedPersistedItems);
    expect(source.items[0].title).toBe("Artwork 1");
  });

  it("keeps identity and aspect through shared-gallery URL decoration, import and save sanitization", () => {
    const source = createAutomaticScene();
    const withShareUrls = addMediaShareTokenToScene(source, "test-share-token") as SceneSnapshot;
    const store = useMetaverseStudioStore.getState();
    store.importScene(withShareUrls);
    expect(store.exportScene().items[0]).toMatchObject({
      assetId: source.items[0].assetId,
      imageAspectRatio: source.items[0].imageAspectRatio,
      assetUrl: `${source.items[0].assetUrl}?shareToken=test-share-token`,
    });
    const saved = sanitizeSceneSnapshot(JSON.parse(JSON.stringify(stripMediaAccessTokensFromScene(store.exportScene()))));
    expect(saved.items).toEqual(source.items);
    store.importScene(saved);
    expect(store.exportScene().items).toEqual(source.items);
  });

  it("continues to import legacy artwork without inventing asset identity or an image ratio", () => {
    const source = createAutomaticScene();
    for (const item of source.items) {
      delete item.imageAspectRatio;
      delete item.assetId;
      delete item.assetUrl;
    }
    const store = useMetaverseStudioStore.getState();
    store.importScene(source);
    expect(store.exportScene().items).toEqual(source.items);
  });

  it('preserves work context through save, load, editing and undo', () => {
    const source = createAutomaticScene();
    source.items[0].workContext = { contribution: 'Built the frame', process: 'Tested two materials',
      sources: [{ label: 'Test log', excerpt: 'The second frame held 2 kg', url: 'https://example.org/log' }] };
    const saved = sanitizeSceneSnapshot(JSON.parse(JSON.stringify(source)));
    const store = useMetaverseStudioStore.getState();
    store.importScene(saved);
    expect(store.exportScene().items[0].workContext).toEqual(source.items[0].workContext);
    store.updateItem(source.items[0].id, { workContext: { contribution: 'Revised contribution' } });
    expect(store.exportScene().items[0].workContext?.contribution).toBe('Revised contribution');
    store.undo();
    expect(store.exportScene().items[0].workContext).toEqual(source.items[0].workContext);
  });
});
