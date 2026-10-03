import { ExhibitItem } from "../../types";

export type InspectorBaseProps<T extends ExhibitItem = ExhibitItem> = {
  selectedItem: T;
  updateItem: (id: string, updates: Partial<ExhibitItem>) => void;
  glassInputClass: string;
  glassButtonClass?: string;
};

export const genericColorItems = {
  flower: {
    labelKey: "genericFlowerColor",
    tipKey: "genericFlowerTip",
    defaultColor: "#ec4899",
  },
  chandelier: {
    labelKey: "genericChandelierColor",
    tipKey: "genericChandelierTip",
    defaultColor: "#fde68a",
  },
  bench: {
    labelKey: "genericBenchColor",
    tipKey: "genericBenchTip",
    defaultColor: "#8b5e3c",
  },
  rug: {
    labelKey: "genericRugColor",
    tipKey: "genericRugTip",
    defaultColor: "#1d4ed8",
  },
  vase: {
    labelKey: "genericVaseColor",
    tipKey: "genericVaseTip",
    defaultColor: "#38bdf8",
  },
  sculpture: {
    labelKey: "genericSculptureColor",
    tipKey: "genericSculptureTip",
    defaultColor: "#9ca3af",
  },
  spotlight: {
    labelKey: "genericSpotlightColor",
    tipKey: "genericSpotlightTip",
    defaultColor: "#fff3b0",
  },
  plant: {
    labelKey: "genericPlantColor",
    tipKey: "genericPlantTip",
    defaultColor: "#22c55e",
  },
  column: {
    labelKey: "genericColumnColor",
    tipKey: "genericColumnTip",
    defaultColor: "#cbd5e1",
  },
  neon: {
    labelKey: "genericNeonColor",
    tipKey: "genericNeonTip",
    defaultColor: "#22d3ee",
  },
  chair: {
    labelKey: "genericChairColor",
    tipKey: "genericChairTip",
    defaultColor: "#9a6b4a",
  },
  sofa: {
    labelKey: "genericSofaColor",
    tipKey: "genericSofaTip",
    defaultColor: "#64748b",
  },
  floorlamp: {
    labelKey: "genericFloorlampColor",
    tipKey: "genericFloorlampTip",
    defaultColor: "#f5d78e",
  },
  cabinet: {
    labelKey: "genericCabinetColor",
    tipKey: "genericCabinetTip",
    defaultColor: "#8b6f47",
  },
  turntable: {
    labelKey: "genericTurntableColor",
    tipKey: "genericTurntableTip",
    defaultColor: "#334155",
  },
  fountain: {
    labelKey: "genericFountainColor",
    tipKey: "genericFountainTip",
    defaultColor: "#60a5fa",
  },
} as const;

export type GenericColorItemType = keyof typeof genericColorItems;
