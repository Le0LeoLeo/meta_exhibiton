import type { ExhibitItem } from '../types';

type TemplateDisplay = { size: [number, number, number]; modelSize: number; totalHeight: number; color: string };
export const VEHICLE_PLATFORM_URL = '/templates/vehicle-platform.glb';
const displays: Record<string, TemplateDisplay> = {
  [VEHICLE_PLATFORM_URL]: { size: [5.4, 0.14, 2.6], modelSize: 0, totalHeight: 0.14, color: '#b8c1c5' },
  '/templates/ribbon-sculpture.glb': { size: [0.85, 0.8, 0.85], modelSize: 1.25, totalHeight: 2.05, color: '#e7e4dc' },
  '/templates/display-device.glb': { size: [0.9, 0.9, 0.65], modelSize: 1.05, totalHeight: 1.95, color: '#d6dde0' },
  '/templates/atelier-bag.glb': { size: [1.05, 0.6, 0.75], modelSize: 0.8, totalHeight: 1.4, color: '#dbcab9' },
  '/templates/concept-car.glb': { size: [5.4, 0.14, 2.6], modelSize: 4.6, totalHeight: 1.85, color: '#b8c1c5' },
};

/** New bundled display layouts use a grounded model; keep legacy offset scenes unchanged. */
export function getTemplateDisplay(item: Pick<ExhibitItem, 'type' | 'content' | 'modelOffset'>): TemplateDisplay | undefined {
  if (item.type !== 'pedestal' || !item.modelOffset || item.modelOffset.some(value => value !== 0)) return undefined;
  return Object.hasOwn(displays, item.content) ? displays[item.content] : undefined;
}
