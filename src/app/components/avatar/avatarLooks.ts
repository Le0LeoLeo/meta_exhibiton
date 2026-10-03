import type { Locale } from "@/app/i18n/catalogs";
import type { AvatarAppearanceV1 } from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import {
  DEFAULT_AVATAR_FACIAL_PLACEMENT,
  type AvatarFacialPlacement,
} from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";

type LocalizedText = Record<Locale, string>;

export type AvatarLookPreset = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  accent: string;
  appearance: AvatarAppearanceV1;
};

function createNeutralFacialPlacement(): AvatarFacialPlacement {
  return {
    eyes: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes },
    eyebrows: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows },
    mouth: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth },
  };
}

export const AVATAR_LOOK_PRESETS: readonly AvatarLookPreset[] = [
  {
    id: "gallery",
    name: { "zh-TW": "藝廊日常", "zh-CN": "艺廊日常", en: "Gallery casual" },
    description: {
      "zh-TW": "低調深藍與乾淨輪廓",
      "zh-CN": "低调深蓝与干净轮廓",
      en: "Clean lines in understated navy",
    },
    accent: "#334c73",
    appearance: {
      version: 1,
      body: "body01",
      head: "head01",
      eyes: "eyes01",
      eyebrows: "eyebrows01",
      mouth: "mouth02",
      hair: "hair01",
      top: "top01",
      bottom: "bottom01",
      shoes: "shoes01",
      accessory: "glasses01",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin02",
        hair: "hairBlack",
        top: "navy",
        bottom: "charcoal",
        shoes: "black",
      },
    },
  },
  {
    id: "creative",
    name: { "zh-TW": "創意策展人", "zh-CN": "创意策展人", en: "Creative curator" },
    description: {
      "zh-TW": "亮色上衣與趣味髮色",
      "zh-CN": "亮色上衣与趣味发色",
      en: "Playful hair with a vivid top",
    },
    accent: "#a45576",
    appearance: {
      version: 1,
      body: "body02",
      head: "head02",
      eyes: "eyes03",
      eyebrows: "eyebrows02",
      mouth: "mouth02",
      hair: "hair03",
      top: "top03",
      bottom: "bottom02",
      shoes: "shoes02",
      accessory: "none",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin03",
        hair: "hairPink",
        top: "violet",
        bottom: "black",
        shoes: "white",
      },
    },
  },
  {
    id: "minimal",
    name: { "zh-TW": "極簡黑白", "zh-CN": "极简黑白", en: "Minimal mono" },
    description: {
      "zh-TW": "俐落黑白，適合正式場合",
      "zh-CN": "利落黑白，适合正式场合",
      en: "Crisp monochrome for formal events",
    },
    accent: "#e7e1d3",
    appearance: {
      version: 1,
      body: "body01",
      head: "head02",
      eyes: "eyes02",
      eyebrows: "eyebrows01",
      mouth: "mouth01",
      hair: "hair02",
      top: "top02",
      bottom: "bottom01",
      shoes: "shoes02",
      accessory: "glasses01",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin04",
        hair: "hairGray",
        top: "ivory",
        bottom: "black",
        shoes: "black",
      },
    },
  },
  {
    id: "weekend",
    name: { "zh-TW": "週末漫遊", "zh-CN": "周末漫游", en: "Weekend wander" },
    description: {
      "zh-TW": "自然色系與輕鬆帽款",
      "zh-CN": "自然色系与轻松帽款",
      en: "Relaxed earth tones with a cap",
    },
    accent: "#5a9b83",
    appearance: {
      version: 1,
      body: "body02",
      head: "head01",
      eyes: "eyes01",
      eyebrows: "eyebrows02",
      mouth: "mouth02",
      hair: "hair02",
      top: "top01",
      bottom: "bottom03",
      shoes: "shoes01",
      accessory: "hat01",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin01",
        hair: "hairBrown",
        top: "mint",
        bottom: "sand",
        shoes: "brown",
      },
    },
  },
  {
    id: "bold",
    name: { "zh-TW": "焦點紅調", "zh-CN": "焦点红调", en: "Bold crimson" },
    description: {
      "zh-TW": "高辨識紅色與深色下身",
      "zh-CN": "高辨识红色与深色下身",
      en: "High-impact red with dark separates",
    },
    accent: "#9f3f4a",
    appearance: {
      version: 1,
      body: "body01",
      head: "head01",
      eyes: "eyes02",
      eyebrows: "eyebrows03",
      mouth: "mouth03",
      hair: "hair03",
      top: "top03",
      bottom: "bottom02",
      shoes: "shoes02",
      accessory: "none",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin05",
        hair: "hairRed",
        top: "crimson",
        bottom: "navy",
        shoes: "red",
      },
    },
  },
  {
    id: "future",
    name: { "zh-TW": "未來藍調", "zh-CN": "未来蓝调", en: "Future blue" },
    description: {
      "zh-TW": "冷色髮型與科技感配色",
      "zh-CN": "冷色发型与科技感配色",
      en: "Cool hair and a tech-inspired palette",
    },
    accent: "#355f8a",
    appearance: {
      version: 1,
      body: "body02",
      head: "head02",
      eyes: "eyes03",
      eyebrows: "eyebrows03",
      mouth: "mouth01",
      hair: "hair01",
      top: "top02",
      bottom: "bottom03",
      shoes: "shoes02",
      accessory: "glasses01",
      facialPlacement: createNeutralFacialPlacement(),
      colors: {
        skin: "skin06",
        hair: "hairBlue",
        top: "teal",
        bottom: "denim",
        shoes: "navy",
      },
    },
  },
] as const;

export const AVATAR_CUSTOMIZER_COPY: Record<
  Locale,
  {
    looks: string;
    looksDescription: string;
    smartMatch: string;
    smartMatchDescription: string;
    undo: string;
    redo: string;
    compareOriginal: string;
    comparingOriginal: string;
    headLabels: Record<AvatarAppearanceV1["head"], string>;
    featureLabels: {
      eyes: string;
      eyebrows: string;
      mouth: string;
    };
    featureOptionLabels: {
      eyes: Record<AvatarAppearanceV1["eyes"], string>;
      eyebrows: Record<AvatarAppearanceV1["eyebrows"], string>;
      mouth: Record<AvatarAppearanceV1["mouth"], string>;
    };
    colorLabels: Record<Exclude<keyof AvatarAppearanceV1["colors"], "topCustom">, string>;
  }
> = {
  "zh-TW": {
    looks: "快速造型",
    looksDescription: "先選完整風格，再到各分類微調。",
    smartMatch: "智能配色",
    smartMatchDescription: "依照上衣自動搭配下身與鞋履。",
    undo: "復原外觀",
    redo: "重做外觀",
    compareOriginal: "比較原本造型",
    comparingOriginal: "正在顯示原本造型",
    headLabels: {
      head01: "圓潤臉",
      head02: "修長臉",
    },
    featureLabels: {
      eyes: "眼睛",
      eyebrows: "眉毛",
      mouth: "嘴型",
    },
    featureOptionLabels: {
      eyes: {
        eyes01: "圓眼",
        eyes02: "細長眼",
        eyes03: "大眼",
      },
      eyebrows: {
        eyebrows01: "平眉",
        eyebrows02: "柔和眉",
        eyebrows03: "英氣眉",
      },
      mouth: {
        mouth01: "自然",
        mouth02: "微笑",
        mouth03: "驚訝",
      },
    },
    colorLabels: {
      skin: "膚色",
      hair: "髮色",
      top: "上衣",
      bottom: "下身",
      shoes: "鞋履",
    },
  },
  "zh-CN": {
    looks: "快速造型",
    looksDescription: "先选完整风格，再到各分类微调。",
    smartMatch: "智能配色",
    smartMatchDescription: "根据上衣自动搭配下身与鞋履。",
    undo: "撤销外观",
    redo: "重做外观",
    compareOriginal: "比较原本造型",
    comparingOriginal: "正在显示原本造型",
    headLabels: {
      head01: "圆润脸",
      head02: "修长脸",
    },
    featureLabels: {
      eyes: "眼睛",
      eyebrows: "眉毛",
      mouth: "嘴型",
    },
    featureOptionLabels: {
      eyes: {
        eyes01: "圆眼",
        eyes02: "细长眼",
        eyes03: "大眼",
      },
      eyebrows: {
        eyebrows01: "平眉",
        eyebrows02: "柔和眉",
        eyebrows03: "英气眉",
      },
      mouth: {
        mouth01: "自然",
        mouth02: "微笑",
        mouth03: "惊讶",
      },
    },
    colorLabels: {
      skin: "肤色",
      hair: "发色",
      top: "上衣",
      bottom: "下身",
      shoes: "鞋履",
    },
  },
  en: {
    looks: "Quick looks",
    looksDescription: "Start with a complete style, then fine-tune each category.",
    smartMatch: "Smart match",
    smartMatchDescription: "Coordinate bottoms and shoes with the selected top.",
    undo: "Undo appearance",
    redo: "Redo appearance",
    compareOriginal: "Compare saved look",
    comparingOriginal: "Showing saved look",
    headLabels: {
      head01: "Rounded face",
      head02: "Long face",
    },
    featureLabels: {
      eyes: "Eyes",
      eyebrows: "Eyebrows",
      mouth: "Mouth",
    },
    featureOptionLabels: {
      eyes: {
        eyes01: "Round eyes",
        eyes02: "Narrow eyes",
        eyes03: "Large eyes",
      },
      eyebrows: {
        eyebrows01: "Straight brows",
        eyebrows02: "Soft brows",
        eyebrows03: "Bold brows",
      },
      mouth: {
        mouth01: "Neutral",
        mouth02: "Smile",
        mouth03: "Surprised",
      },
    },
    colorLabels: {
      skin: "Skin",
      hair: "Hair",
      top: "Top",
      bottom: "Bottom",
      shoes: "Shoes",
    },
  },
};

export function harmonizeAvatarColors(
  appearance: AvatarAppearanceV1,
): AvatarAppearanceV1 {
  const matchByTop: Partial<Record<
    AvatarAppearanceV1["colors"]["top"],
    Pick<AvatarAppearanceV1["colors"], "bottom" | "shoes">
  >> = {
    navy: { bottom: "denim", shoes: "white" },
    teal: { bottom: "navy", shoes: "white" },
    violet: { bottom: "black", shoes: "black" },
    rose: { bottom: "charcoal", shoes: "white" },
    amber: { bottom: "brown", shoes: "brown" },
    black: { bottom: "black", shoes: "white" },
    ivory: { bottom: "sand", shoes: "brown" },
    mint: { bottom: "olive", shoes: "white" },
    crimson: { bottom: "black", shoes: "red" },
  };
  return {
    ...appearance,
    colors: {
      ...appearance.colors,
      ...matchByTop[appearance.colors.top],
    },
  };
}
