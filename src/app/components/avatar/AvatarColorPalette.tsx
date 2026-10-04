import * as React from "react";

import { cn } from "@/app/components/ui/utils";

export type AvatarColorOption = {
  value: string;
  label: string;
  color: string;
  disabled?: boolean;
};

export type AvatarColorPaletteProps = Omit<
  React.ComponentProps<"div">,
  "onChange"
> & {
  label: string;
  options: readonly AvatarColorOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function AvatarColorPalette({
  label,
  options,
  value,
  onValueChange,
  className,
  ...props
}: AvatarColorPaletteProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="avatar-color-palette"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={selected}
            title={option.label}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex size-11 items-center justify-center rounded-full border-2 bg-card p-1 shadow-xs outline-none transition-transform",
              "hover:scale-105 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
              selected ? "border-primary" : "border-border",
            )}
          >
            <span
              aria-hidden="true"
              className="size-full rounded-full border border-black/10"
              style={{ backgroundColor: option.color }}
            />
            {selected ? (
              <span
                aria-hidden="true"
                className="absolute inset-1 rounded-full ring-2 ring-white/90 ring-offset-1 ring-offset-black/20"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
