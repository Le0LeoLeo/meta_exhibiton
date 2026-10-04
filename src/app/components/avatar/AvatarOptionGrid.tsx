import * as React from "react";

import { cn } from "@/app/components/ui/utils";

export type AvatarOption = {
  value: string;
  label: string;
  thumbnailUrl?: string;
  disabled?: boolean;
};

export type AvatarOptionGridProps = Omit<
  React.ComponentProps<"div">,
  "onChange"
> & {
  label: string;
  options: readonly AvatarOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function AvatarOptionGrid({
  label,
  options,
  value,
  onValueChange,
  className,
  ...props
}: AvatarOptionGridProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="avatar-option-grid"
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={option.label}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex min-h-11 min-w-11 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-2 text-sm font-medium text-foreground shadow-xs outline-none transition-colors",
              "hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-50",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border",
            )}
          >
            {option.thumbnailUrl ? (
              <img
                src={option.thumbnailUrl}
                alt=""
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
