import { describe, expect, it } from 'vitest';
import { dictionaries, type Locale } from '@/app/i18n/catalogs';
import {
  decorThemePresets,
  editorThemePresetLabelKeys,
  floorTexturePresets,
  itemToolButtons,
  modelLibraryButtons,
  selectedItemTypeLabelMap,
  wallTexturePresets,
} from './editorConstants';

const locales: Locale[] = ['en', 'zh-TW', 'zh-CN'];

describe('localized built-in editor labels', () => {
  it('has a localized label for every built-in exhibit type', () => {
    const allTypes = [...itemToolButtons.map(({ type }) => type), ...modelLibraryButtons.map(({ type }) => type)];
    expect(Object.keys(selectedItemTypeLabelMap).sort()).toEqual([...new Set(allTypes)].sort());

    const keys = [...new Set([
      ...Object.values(selectedItemTypeLabelMap),
      ...itemToolButtons.map(({ labelKey }) => labelKey),
      ...modelLibraryButtons.map(({ labelKey }) => labelKey),
    ])];
    for (const locale of locales) {
      for (const key of keys) expect(dictionaries[locale][key]?.trim(), `${locale}.${key}`).toBeTruthy();
    }
  });

  it('localizes built-in theme and texture labels without changing stored names or asset values', () => {
    const textures = [...wallTexturePresets, ...floorTexturePresets];
    const themeKeys = Object.values(editorThemePresetLabelKeys);
    const keys = [...textures.map(({ labelKey }) => labelKey), ...themeKeys];
    for (const locale of locales) {
      for (const key of keys) expect(dictionaries[locale][key]?.trim(), `${locale}.${key}`).toBeTruthy();
    }
    expect(wallTexturePresets.map(({ value }) => value)).toEqual([
      '/textures/wall-paint.svg', '/textures/wall-concrete.svg', '/textures/wall-wood.svg', '/textures/wall-metal.svg',
    ]);
    expect(floorTexturePresets.map(({ value }) => value)).toEqual([
      '/textures/wall-concrete.svg', '/textures/wall-wood.svg', '/textures/wall-paint.svg', '/textures/wall-metal.svg',
    ]);
    expect(decorThemePresets.map(({ name }) => name)).toEqual(['北歐畫廊', '工業風', '木質藝廊', '未來金屬', '玻璃空間']);
  });
});
