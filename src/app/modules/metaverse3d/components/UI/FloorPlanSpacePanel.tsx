import { NumericControlField } from "./NumericControlField";
import { useI18n } from "../../../../components/I18nProvider";

interface FloorPlanSpacePanelProps {
  selectedRoomElement: {
    id: string;
    scale: [number, number, number];
    isLocked?: boolean;
  } | null;
  roomSize: {
    width: number;
    length: number;
    height: number;
    wallThickness: number;
    environmentBrightness?: number;
  };
  onUpdateSelectedRoom: (id: string, scale: [number, number, number]) => void;
  onSetRoomSize: (updates: Partial<{ width: number; length: number; height: number; wallThickness: number; environmentBrightness: number }>) => void;
}

export function FloorPlanSpacePanel({ selectedRoomElement, roomSize, onUpdateSelectedRoom, onSetRoomSize }: FloorPlanSpacePanelProps) {
  const { t } = useI18n();
  return (
    <details className="rounded-2xl border border-white/14 bg-white/8 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md" open>
      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">{t('fpspSummary')}</summary>
      <div className="mt-3 space-y-3">
        <NumericControlField
          label={t('fpspWidth')}
          value={selectedRoomElement ? Math.abs(selectedRoomElement.scale[0]) : roomSize.width}
          min={4}
          max={80}
          step={0.5}
          unit="m"
          onChange={(width) => {
            if (selectedRoomElement) {
              onUpdateSelectedRoom(selectedRoomElement.id, [width, selectedRoomElement.scale[1], selectedRoomElement.scale[2]]);
            } else {
              onSetRoomSize({ width });
            }
          }}
        />

        <NumericControlField
          label={t('fpspLength')}
          value={selectedRoomElement ? Math.abs(selectedRoomElement.scale[2]) : roomSize.length}
          min={4}
          max={80}
          step={0.5}
          unit="m"
          onChange={(length) => {
            if (selectedRoomElement) {
              onUpdateSelectedRoom(selectedRoomElement.id, [selectedRoomElement.scale[0], selectedRoomElement.scale[1], length]);
            } else {
              onSetRoomSize({ length });
            }
          }}
        />

        <NumericControlField label={t('fpspHeight')} value={roomSize.height} min={3} max={15} step={0.5} unit="m" onChange={(height) => onSetRoomSize({ height })} />
        <NumericControlField label={t('fpspWallThickness')} value={roomSize.wallThickness} min={0.1} max={2} step={0.1} unit="m" precision={1} onChange={(wallThickness) => onSetRoomSize({ wallThickness })} />
        <NumericControlField label={t('fpspEnvBrightness')} value={roomSize.environmentBrightness ?? 1} min={0.2} max={2.5} step={0.05} suffix="x" precision={2} onChange={(environmentBrightness) => onSetRoomSize({ environmentBrightness })} />

        {!selectedRoomElement && <p className="text-[11px] text-[rgb(192,179,170)]">{t('fpspHint')}</p>}
      </div>
    </details>
  );
}
