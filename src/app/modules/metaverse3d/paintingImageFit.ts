/** Fit the entire image into a display area without cropping or stretching. */
export function fitImageWithin(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (![width, height, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid image or display bounds");
  }
  const aspect = width / height;
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new Error("Invalid image or display bounds");
  }
  return aspect > maxWidth / maxHeight
    ? { width: maxWidth, height: maxWidth / aspect }
    : { width: maxHeight * aspect, height: maxHeight };
}

/**
 * Dimensions are local to the painting; the existing item scale still applies.
 * borderOverride is half a frame rail's visible thickness: rails straddle the
 * nominal frame bounds, extending this far both inward and outward. Zero makes
 * the canvas borderless; omission preserves saved scenes' historical geometry.
 */
export function getPaintingImageFit(
  width = 2,
  height = 1.5,
  imageAspectRatio?: number,
  borderOverride?: number,
) {
  const frameWidth = Math.max(0.8, width);
  const frameHeight = Math.max(0.6, height);
  const legacyBorder = Math.max(0.08, Math.min(0.16, Math.min(frameWidth, frameHeight) * 0.08));
  const frameBorder = borderOverride !== undefined && Number.isFinite(borderOverride)
    ? Math.max(0, Math.min(borderOverride, 0.5, Math.min(frameWidth, frameHeight) / 4))
    : legacyBorder;
  const canvasWidth = Math.max(0.2, frameWidth - frameBorder * 2);
  const canvasHeight = Math.max(0.2, frameHeight - frameBorder * 2);
  const image = imageAspectRatio !== undefined && Number.isFinite(imageAspectRatio) && imageAspectRatio > 0
    ? fitImageWithin(imageAspectRatio, 1, canvasWidth, canvasHeight)
    : { width: canvasWidth, height: canvasHeight };

  return {
    frameWidth,
    frameHeight,
    frameBorder,
    outerWidth: frameWidth + frameBorder * 2,
    outerHeight: frameHeight + frameBorder * 2,
    canvasWidth,
    canvasHeight,
    imageWidth: image.width,
    imageHeight: image.height,
  };
}
