export const defaultGalleryScene = JSON.parse(`{
  "roomSize": {
    "wallColor": "#ffffff",
    "wallMaterialPreset": "paint",
    "wallTextureUrl": "/textures/pbr/plaster-wall",
    "wallTextureTiling": 1,
    "wallRoughness": 0.88,
    "wallMetalness": 0,
    "wallBumpScale": 0,
    "wallEnvIntensity": 0.3,
    "wallOpacity": 1,
    "wallTransmission": 0,
    "wallIor": 1.45,
    "floorColor": "#ffffff",
    "floorTextureUrl": "/textures/pbr/oak-floor",
    "floorTextureTiling": 1,
    "floorRoughness": 0.62,
    "floorMetalness": 0,
    "environmentBrightness": 0.56,
    "width": 9,
    "length": 50,
    "height": 6,
    "wallThickness": 0.1
  },
  "items": [
    {
      "id": "default-left-painting",
      "type": "painting",
      "position": [-4.4, 1.55, 2],
      "rotation": [0, 1.5707963267948966, 0],
      "scale": [1, 1, 1],
      "content": "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800",
      "frameWidth": 2,
      "frameHeight": 1.5,
      "title": "Chromatic Field",
      "artist": "Gallery Collection",
      "description": "A study in layered colour and rhythm.",
      "externalUrl": ""
    },
    {
      "id": "default-right-painting",
      "type": "painting",
      "position": [4.4, 1.55, 6.5],
      "rotation": [0, -1.5707963267948966, 0],
      "scale": [1, 1, 1],
      "content": "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&q=80&w=800",
      "frameWidth": 2,
      "frameHeight": 1.5,
      "title": "Quiet Geometry",
      "artist": "Gallery Collection",
      "description": "Architectural forms reduced to light and colour.",
      "externalUrl": ""
    },
    {
      "id": "default-hero-partition",
      "type": "partition",
      "position": [2.9, 3, -2],
      "rotation": [0, 1.5707963267948966, 0],
      "scale": [3.8, 6, 0.2],
      "content": "#f3f4f6",
      "isLocked": true
    },
    {
      "id": "default-hero-painting",
      "type": "painting",
      "position": [2.76, 1.55, -2],
      "rotation": [0, -1.5707963267948966, 0],
      "scale": [1, 1, 1],
      "content": "https://images.unsplash.com/photo-1549490349-8643362247b5?auto=format&fit=crop&q=80&w=800",
      "frameWidth": 2.2,
      "frameHeight": 1.6,
      "title": "Threshold",
      "artist": "Gallery Collection",
      "description": "The focal work at the start of the exhibition.",
      "externalUrl": ""
    },
    {
      "id": "default-hero-lightstrip",
      "type": "lightstrip",
      "position": [2.66, 2.65, -2],
      "rotation": [0, -1.5707963267948966, 0],
      "scale": [2.2, 0.08, 0.08],
      "content": "#ffe8b0",
      "lightIntensity": 0.35
    },
    {
      "id": "default-bench",
      "type": "bench",
      "position": [2.5, 0.55, 4.5],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "content": "#8b6f55"
    },
    {
      "id": "default-pedestal",
      "type": "pedestal",
      "position": [-2.4, 0.6, 8.5],
      "rotation": [0, 0, 0],
      "scale": [1, 1.2, 1],
      "content": ""
    },
    {
      "id": "default-sculpture",
      "type": "sculpture",
      "position": [-2.4, 1.55, 8.5],
      "rotation": [0, 0.45, 0],
      "scale": [0.65, 0.65, 0.65],
      "content": "#b9a58f",
      "title": "Fold"
    },
    {
      "id": "default-plant",
      "type": "plant",
      "position": [3.35, 0.7, 11],
      "rotation": [0, -0.35, 0],
      "scale": [0.9, 1.15, 0.9],
      "content": "#3f7d4b"
    }
  ],
  "floorPlanElements": [
    {
      "id": "room-9ufiz5sd",
      "type": "room",
      "position": [8, 0.02, 12.5],
      "rotation": [0, 0, 0],
      "scale": [9, 0.04, 50],
      "color": "#dbeafe",
      "isLocked": true,
      "doorWidth": 1.8
    },
    {
      "id": "6d36eb9d-27c2-4350-8711-09f69ffff045",
      "type": "room",
      "position": [25, 0.02, 0],
      "rotation": [0, 0, 0],
      "scale": [25, 0.04, 25],
      "color": "#dbeafe",
      "isLocked": false,
      "doorWidth": 1.8
    },
    {
      "id": "a0218829-6cd0-4b7a-b34e-97031f9a576c",
      "type": "room",
      "position": [25, 0.02, 25],
      "rotation": [0, 0, 0],
      "scale": [25, 0.04, 25],
      "color": "#dbeafe",
      "isLocked": false
    },
    {
      "id": "95516af8-8c92-4cc1-a5a7-6ff524b6eec2",
      "type": "room",
      "position": [-9, 0.02, 25],
      "rotation": [0, 0, 0],
      "scale": [25, 0.04, 25],
      "color": "#dbeafe",
      "isLocked": false
    },
    {
      "id": "bc51d7d0-de4f-47fd-88eb-817830567e4e",
      "type": "room",
      "position": [-9, 0.02, 0],
      "rotation": [0, 0, 0],
      "scale": [25, 0.04, 25],
      "color": "#dbeafe",
      "isLocked": false
    }
  ],
  "wallMaterialOverrides": {
    "bc51d7d0-de4f-47fd-88eb-817830567e4e:south:-8.10-3.50": {
      "wallOpacity": 1
    },
    "95516af8-8c92-4cc1-a5a7-6ff524b6eec2:west:12.50-37.50": {
      "wallTransmission": 1,
      "wallIor": 2.5
    }
  }
}`) as SceneSnapshot;
import type { SceneSnapshot } from "./metaverseStoreTypes";
