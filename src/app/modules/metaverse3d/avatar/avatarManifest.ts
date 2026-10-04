export const AVATAR_MANIFEST = {
  modelUrl: "/models/avatars/casual-v1/casual1-male.glb",
  assetReady: true,
  nodes: {
    body: {
      body01: "Body_body01",
      body02: "Body_body02",
    },
    head: {
      head01: "Head_head01",
      head02: "Head_head02",
    },
    hair: {
      hair01: "Hair_hair01",
      hair02: "Hair_hair02",
      hair03: "Hair_hair03",
    },
    top: {
      top01: "Top_top01",
      top02: "Top_top02",
      top03: "Top_top03",
    },
    bottom: {
      bottom01: "Bottom_bottom01",
      bottom02: "Bottom_bottom02",
      bottom03: "Bottom_bottom03",
    },
    shoes: {
      shoes01: "Shoes_shoes01",
      shoes02: "Shoes_shoes02",
    },
    accessory: {
      none: "Accessory_none",
      glasses01: "Accessory_glasses01",
      hat01: "Accessory_hat01",
    },
  },
  features: {
    eyes: {
      eyes01: "round",
      eyes02: "narrow",
      eyes03: "large",
    },
    eyebrows: {
      eyebrows01: "straight",
      eyebrows02: "soft",
      eyebrows03: "bold",
    },
    mouth: {
      mouth01: "neutral",
      mouth02: "smile",
      mouth03: "open",
    },
  },
  colors: {
    skin: {
      skin01: "#f6d0b1",
      skin02: "#e8b68f",
      skin03: "#c98b65",
      skin04: "#936044",
      skin05: "#5f3c2d",
      skin06: "#3f271e",
    },
    hair: {
      hairBlack: "#242126",
      hairBrown: "#5c3929",
      hairBlonde: "#d3ad61",
      hairRed: "#9a422f",
      hairGray: "#7b7d83",
      hairBlue: "#355f8a",
      hairPink: "#a45576",
    },
    top: {
      navy: "#334c73",
      teal: "#248a8a",
      violet: "#7862a6",
      rose: "#b85d73",
      amber: "#c7852f",
      black: "#23262d",
      ivory: "#e7e1d3",
      mint: "#5a9b83",
      crimson: "#9f3f4a",
      sky: "#3b82f6",
      cobalt: "#1d4ed8",
      emerald: "#059669",
      lime: "#65a30d",
      orange: "#ea580c",
      burgundy: "#7f1d1d",
      chocolate: "#78350f",
      slate: "#64748b",
    },
    bottom: {
      charcoal: "#3e424a",
      navy: "#293c5a",
      brown: "#60483c",
      black: "#22252b",
      olive: "#5c6347",
      sand: "#aa8f6a",
      denim: "#3f6084",
    },
    shoes: {
      black: "#24272c",
      white: "#e8e6df",
      brown: "#654538",
      navy: "#303f59",
      red: "#8a3b3f",
    },
  },
} as const;

export type AvatarBodyId = keyof typeof AVATAR_MANIFEST.nodes.body;
export type AvatarHeadId = keyof typeof AVATAR_MANIFEST.nodes.head;
export type AvatarHairId = keyof typeof AVATAR_MANIFEST.nodes.hair;
export type AvatarTopId = keyof typeof AVATAR_MANIFEST.nodes.top;
export type AvatarBottomId = keyof typeof AVATAR_MANIFEST.nodes.bottom;
export type AvatarShoesId = keyof typeof AVATAR_MANIFEST.nodes.shoes;
export type AvatarAccessoryId = keyof typeof AVATAR_MANIFEST.nodes.accessory;
export type AvatarEyesId = keyof typeof AVATAR_MANIFEST.features.eyes;
export type AvatarEyebrowsId = keyof typeof AVATAR_MANIFEST.features.eyebrows;
export type AvatarMouthId = keyof typeof AVATAR_MANIFEST.features.mouth;

export type AvatarSkinColorId = keyof typeof AVATAR_MANIFEST.colors.skin;
export type AvatarHairColorId = keyof typeof AVATAR_MANIFEST.colors.hair;
export type AvatarTopColorId = keyof typeof AVATAR_MANIFEST.colors.top;
export type AvatarBottomColorId = keyof typeof AVATAR_MANIFEST.colors.bottom;
export type AvatarShoesColorId = keyof typeof AVATAR_MANIFEST.colors.shoes;
