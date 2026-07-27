import { en } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';

export type Locale = 'zh-TW' | 'zh-CN' | 'en';
export type MessageKey = keyof typeof zhTW | keyof typeof zhCN | keyof typeof en;
export type Dictionary = Record<string, string>;

export const dictionaries: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  en,
};
