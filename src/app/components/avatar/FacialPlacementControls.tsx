import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import {
  AVATAR_FACIAL_PLACEMENT_LIMITS,
  type AvatarFacialPlacement,
} from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";

const SLIDER_ADJUSTMENT_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

export type FacialPlacementLabels = {
  help: string;
  eyes: string;
  eyeHeight: string;
  eyeSpacing: string;
  eyeSize: string;
  eyebrows: string;
  eyebrowHeight: string;
  eyebrowSpacing: string;
  eyebrowTilt: string;
  mouth: string;
  mouthHorizontal: string;
  mouthHeight: string;
  mouthWidth: string;
  mouthHeightScale: string;
  reset: string;
};

type FacialPlacementControlsProps = {
  value: AvatarFacialPlacement;
  labels: FacialPlacementLabels;
  onGestureStart: () => void;
  onPreview: (value: AvatarFacialPlacement) => void;
  onCommit: (value: AvatarFacialPlacement) => void;
  onCancel: () => void;
  onReset: () => void;
};

type SliderRowProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: "offset" | "scale" | "rotation";
  onGestureStart: () => void;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
  onCancel: () => void;
};

function formatValue(value: number, format: SliderRowProps["format"]) {
  if (format === "scale") return `${Math.round(value * 100)}%`;
  const rounded = Math.round(value * 1000) / 1000;
  const prefix = rounded > 0 ? "+" : "";
  return format === "rotation"
    ? `${prefix}${rounded.toFixed(2)} rad`
    : `${prefix}${rounded.toFixed(3)}`;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onGestureStart,
  onPreview,
  onCommit,
  onCancel,
}: SliderRowProps) {
  return (
    <div className="flex min-h-14 items-center gap-3">
      <div className="min-w-0 basis-36">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block font-mono text-xs tabular-nums text-muted-foreground">
          {formatValue(value, format)}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        className="min-h-11 flex-1"
        onFocus={onGestureStart}
        onPointerDown={onGestureStart}
        onPointerCancel={onCancel}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          } else if (SLIDER_ADJUSTMENT_KEYS.has(event.key)) {
            onGestureStart();
          }
        }}
        onValueChange={([next]) => onPreview(next)}
        onValueCommit={([next]) => onCommit(next)}
      />
    </div>
  );
}

export function FacialPlacementControls({
  value,
  labels,
  onGestureStart,
  onPreview,
  onCommit,
  onCancel,
  onReset,
}: FacialPlacementControlsProps) {
  const eyeValue = (
    key: keyof AvatarFacialPlacement["eyes"],
    next: number,
  ): AvatarFacialPlacement => ({
    ...value,
    eyes: { ...value.eyes, [key]: next },
  });
  const eyebrowValue = (
    key: keyof AvatarFacialPlacement["eyebrows"],
    next: number,
  ): AvatarFacialPlacement => ({
    ...value,
    eyebrows: { ...value.eyebrows, [key]: next },
  });
  const mouthValue = (
    key: keyof AvatarFacialPlacement["mouth"],
    next: number,
  ): AvatarFacialPlacement => ({
    ...value,
    mouth: { ...value.mouth, [key]: next },
  });

  const row = (
    label: string,
    current: number,
    limits: { min: number; max: number; step: number },
    format: SliderRowProps["format"],
    build: (next: number) => AvatarFacialPlacement,
  ) => (
    <SliderRow
      label={label}
      value={current}
      {...limits}
      format={format}
      onGestureStart={onGestureStart}
      onPreview={(next) => onPreview(build(next))}
      onCommit={(next) => onCommit(build(next))}
      onCancel={onCancel}
    />
  );

  return (
    <div className="space-y-6">
      <p className="text-xs leading-5 text-muted-foreground">{labels.help}</p>

      <section aria-labelledby="facial-placement-eyes">
        <h2 id="facial-placement-eyes" className="text-sm font-semibold">
          {labels.eyes}
        </h2>
        {row(
          labels.eyeHeight,
          value.eyes.offsetY,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.offsetY,
          "offset",
          (next) => eyeValue("offsetY", next),
        )}
        {row(
          labels.eyeSpacing,
          value.eyes.spacing,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.spacing,
          "offset",
          (next) => eyeValue("spacing", next),
        )}
        {row(
          labels.eyeSize,
          value.eyes.scale,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyes.scale,
          "scale",
          (next) => eyeValue("scale", next),
        )}
      </section>

      <section aria-labelledby="facial-placement-eyebrows">
        <h2 id="facial-placement-eyebrows" className="text-sm font-semibold">
          {labels.eyebrows}
        </h2>
        {row(
          labels.eyebrowHeight,
          value.eyebrows.offsetY,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.offsetY,
          "offset",
          (next) => eyebrowValue("offsetY", next),
        )}
        {row(
          labels.eyebrowSpacing,
          value.eyebrows.spacing,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.spacing,
          "offset",
          (next) => eyebrowValue("spacing", next),
        )}
        {row(
          labels.eyebrowTilt,
          value.eyebrows.rotation,
          AVATAR_FACIAL_PLACEMENT_LIMITS.eyebrows.rotation,
          "rotation",
          (next) => eyebrowValue("rotation", next),
        )}
      </section>

      <section aria-labelledby="facial-placement-mouth">
        <h2 id="facial-placement-mouth" className="text-sm font-semibold">
          {labels.mouth}
        </h2>
        {row(
          labels.mouthHorizontal,
          value.mouth.offsetX,
          AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetX,
          "offset",
          (next) => mouthValue("offsetX", next),
        )}
        {row(
          labels.mouthHeight,
          value.mouth.offsetY,
          AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.offsetY,
          "offset",
          (next) => mouthValue("offsetY", next),
        )}
        {row(
          labels.mouthWidth,
          value.mouth.scaleX,
          AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleX,
          "scale",
          (next) => mouthValue("scaleX", next),
        )}
        {row(
          labels.mouthHeightScale,
          value.mouth.scaleY,
          AVATAR_FACIAL_PLACEMENT_LIMITS.mouth.scaleY,
          "scale",
          (next) => mouthValue("scaleY", next),
        )}
      </section>

      <Button type="button" variant="outline" onClick={onReset}>
        {labels.reset}
      </Button>
    </div>
  );
}
