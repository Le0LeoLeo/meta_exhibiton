import { getTemplateSceneJson } from '@/app/constants/gallerySceneTemplates';
import type { SceneSnapshot } from '@/app/modules/metaverse3d/store/metaverseStoreTypes';

import type { Locale } from '@/app/components/I18nProvider';
import { getClassSampleCopy } from './classSample';
import { getDemoExhibition } from './demoCatalog';
export { demoArtworks, demoExhibitions, getDemoExhibition } from './demoCatalog';

export function createDemoScene(t: (key: string) => string, exhibitionId = 'class', locale: Locale = 'en'): SceneSnapshot {
  const exhibition = getDemoExhibition(exhibitionId);
  const scene = JSON.parse(getTemplateSceneJson('現代藝術畫廊')!) as SceneSnapshot;
  scene.roomSize = { ...scene.roomSize, floorColor: '#b7aea1', wallColor: exhibition.wall };
  const classCopy = exhibition.id === 'class' ? getClassSampleCopy(locale) : null;
  scene.items = exhibition.artworks.map((artwork, index) => ({
    id: `official-demo-${artwork.id}`, type: 'painting',
    // Four on the back wall, four on the right, three on the left; leave the entrance clear.
    position: index < 4 ? [-9 + index * 6, 2.4, -10.9] : index < 8 ? [12.9, 2.4, -7 + (index - 4) * 5] : [-12.9, 2.4, 7 - (index - 8) * 7],
    rotation: [0, index < 4 ? 0 : index < 8 ? -Math.PI / 2 : Math.PI / 2, 0], scale: [1, 1, 1],
    content: `/demo/met-${artwork.id}.jpg`,
    ...(classCopy
      ? { title: classCopy.works[index].title, description: classCopy.works[index].description, artist: `${classCopy.works[index].artist} · ${artwork.date}`, workContext: classCopy.works[index].workContext }
      : { title: t(`demoArtwork${artwork.key}Title`), description: t(`demoArtwork${artwork.key}Description`), artist: `${t(`demoArtwork${artwork.key}Artist`)} · ${artwork.date}` }),
    frameWidth: 2.4 * artwork.width / artwork.height, frameHeight: 2.4,
  }));
  if (classCopy) {
    // Same wall text a creator would add in the editor; paintings keep their indexes.
    scene.items.push({
      id: 'official-demo-inquiry', type: 'text', position: [-scene.roomSize.width / 2 + 0.2, 2.6, 0], rotation: [0, Math.PI / 2, 0], scale: [1, 1, 1],
      content: classCopy.inquiryWall, title: classCopy.inquiryLabel,
      textFontFamily: 'sans', textFontSize: 0.18, textColor: '#3f3a33', textIsBold: false, textBackboardEnabled: true,
    });
  }
  return scene;
}
