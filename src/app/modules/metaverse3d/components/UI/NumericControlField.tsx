import { useEffect, useState } from "react";

interface NumericControlFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  suffix?: string;
  description?: string;
  disabled?: boolean;
  precision?: number;
  onChange: (value: number) => void;
}

export function NumericControlField({
  label,
  value,
  min,
  max,
  step,
  unit,
  suffix,
  description,
  disabled = false,
  precision,
  onChange,
}: NumericControlFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [value, isEditing]);

  const displayValue =
    precision != null ? value.toFixed(precision) : Number.isInteger(value) ? String(value) : value.toFixed(1);

  const commit = () => {
    if (draft.trim() === "") {
      setDraft(displayValue);
      return;
    }

    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(displayValue);
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    onChange(clamped);
    setIsEditing(false);
    setDraft(String(clamped));
  };

  return (
    <div>
      <div className="mb-1 flex justify-between gap-2">
        <label className="text-xs font-medium text-white">{label}</label>
        <span className="text-xs text-white">
          {displayValue}
          {suffix ?? unit ?? ""}
        </span>
      </div>
      {description && <p className="mb-1 text-[11px] text-white/55">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={label}
          aria-valuetext={`${displayValue}${suffix ?? unit ?? ""}`}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-white"
        />
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={isEditing ? draft : displayValue}
          onFocus={() => {
            setIsEditing(true);
            setDraft(String(value));
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-20 rounded-xl border border-white/12 bg-white/8 px-2 py-1 text-xs text-white outline-none placeholder:text-white/40 disabled:bg-white/5"
        />
      </div>
    </div>
  );
}
