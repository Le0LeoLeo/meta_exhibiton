import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

function configureSharedTexture(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function configureColorTexture(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.colorSpace = SRGBColorSpace;
  return configureSharedTexture(texture, repeatX, repeatY, anisotropy);
}

export function configureDataTexture(
  texture: Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
) {
  texture.colorSpace = LinearSRGBColorSpace;
  return configureSharedTexture(texture, repeatX, repeatY, anisotropy);
}
