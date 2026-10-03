import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { normalizeAvatarHexColor } from "@/app/modules/metaverse3d/avatar/avatarAppearance";

export type AvatarCustomColorLabels = {
  title: string;
  description: string;
  picker: string;
  input: string;
  invalid: string;
  clear: string;
};

export type AvatarCustomColorControlProps = {
  value?: string;
  fallbackColor: string;
  labels: AvatarCustomColorLabels;
  onValueChange: (value: string) => void;
  onClear: () => void;
  onPickerGestureStart?: () => void;
  onPickerPreview?: (value: string) => void;
  onPickerCommit?: (value: string) => void;
  onPickerCancel?: () => void;
};

export function AvatarCustomColorControl({
  value,
  fallbackColor,
  labels,
  onValueChange,
  onClear,
  onPickerGestureStart,
  onPickerPreview,
  onPickerCommit,
  onPickerCancel,
}: AvatarCustomColorControlProps) {
  const inputId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const effectiveColor =
    normalizeAvatarHexColor(value) ??
    normalizeAvatarHexColor(fallbackColor) ??
    "#000000";
  const [draft, setDraft] = useState(value ?? effectiveColor);
  const [invalid, setInvalid] = useState(false);
  const lastSubmittedDraftRef = useRef<string | null>(null);
  const pickerGestureActiveRef = useRef(false);
  const pickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? effectiveColor);
    setInvalid(false);
    lastSubmittedDraftRef.current = null;
  }, [effectiveColor, value]);

  const commitDraft = () => {
    const normalized = normalizeAvatarHexColor(draft);
    if (!normalized) {
      setInvalid(true);
      return;
    }

    setDraft(normalized);
    setInvalid(false);
    if (
      normalized !== value &&
      lastSubmittedDraftRef.current !== normalized
    ) {
      lastSubmittedDraftRef.current = normalized;
      onValueChange(normalized);
    }
  };

  const beginPickerGesture = () => {
    if (pickerGestureActiveRef.current) return;
    pickerGestureActiveRef.current = true;
    onPickerGestureStart?.();
  };

  const handlePickerPreview = (nextValue: string) => {
    const normalized = normalizeAvatarHexColor(nextValue);
    if (!normalized) return;
    beginPickerGesture();
    setDraft(normalized);
    setInvalid(false);
    onPickerPreview?.(normalized);
  };

  const handlePickerCommit = (nextValue: string) => {
    const normalized = normalizeAvatarHexColor(nextValue);
    if (!normalized) return;
    beginPickerGesture();
    setDraft(normalized);
    setInvalid(false);
    pickerGestureActiveRef.current = false;
    if (onPickerCommit) {
      onPickerCommit(normalized);
    } else if (normalized !== value) {
      onValueChange(normalized);
    }
  };

  const cancelPickerGesture = () => {
    if (!pickerGestureActiveRef.current) return;
    pickerGestureActiveRef.current = false;
    onPickerCancel?.();
  };

  useEffect(() => {
    const picker = pickerInputRef.current;
    if (!picker) return;
    const handleNativeChange = (event: Event) => {
      handlePickerCommit((event.currentTarget as HTMLInputElement).value);
    };
    picker.addEventListener("change", handleNativeChange);
    return () => picker.removeEventListener("change", handleNativeChange);
  });

  return (
    <div
      data-testid="avatar-custom-color"
      data-selected={value ? "true" : "false"}
      className={cn(
        "mt-4 rounded-xl border bg-muted/30 p-4",
        value ? "border-primary/60 ring-2 ring-primary/10" : "border-border",
      )}
    >
      <h3 className="text-sm font-semibold">{labels.title}</h3>
      <p
        id={descriptionId}
        className="mt-1 text-xs leading-5 text-muted-foreground"
      >
        {labels.description}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Label className="flex min-w-11 flex-col items-start gap-2">
          <span className="sr-only">{labels.picker}</span>
          <input
            ref={pickerInputRef}
            type="color"
            aria-label={labels.picker}
            aria-describedby={descriptionId}
            value={effectiveColor}
            onPointerDown={beginPickerGesture}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                beginPickerGesture();
              }
            }}
            onInput={(event) =>
              handlePickerPreview(event.currentTarget.value)
            }
            onBlur={cancelPickerGesture}
            className="size-11 cursor-pointer rounded-md border border-input bg-card p-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Label>

        <div className="min-w-44 flex-1">
          <Label htmlFor={inputId}>{labels.input}</Label>
          <Input
            id={inputId}
            className="mt-2 font-mono uppercase"
            value={draft}
            maxLength={7}
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={
              invalid ? `${descriptionId} ${errorId}` : descriptionId
            }
            aria-invalid={invalid}
            onChange={(event) => {
              setDraft(event.target.value);
              setInvalid(false);
              lastSubmittedDraftRef.current = null;
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commitDraft();
            }}
          />
        </div>

        {value ? (
          <Button type="button" variant="outline" onClick={onClear}>
            {labels.clear}
          </Button>
        ) : null}
      </div>

      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-xs text-destructive"
        >
          {labels.invalid}
        </p>
      ) : null}
    </div>
  );
}
