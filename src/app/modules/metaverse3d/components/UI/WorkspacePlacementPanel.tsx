import { ExhibitItem, RoomSize, WallFace } from "../../types";
import { useI18n } from "../../../../components/I18nProvider";

type Props = {
  autoAddTopLightstrip: boolean;
  setAutoAddTopLightstrip: (value: boolean) => void;
  selectedWallFace: WallFace | null | undefined;
  spawnLocation: "center" | "north" | "south" | "east" | "west";
  selectedItem: ExhibitItem | undefined;
  roomSize: RoomSize;
  wallBatchSpacing: number;
  setWallBatchSpacing: (value: number) => void;
  wallBatchCount: number;
  setWallBatchCount: (value: number) => void;
  partitionAttachSide: "front" | "back";
  setPartitionAttachSide: (value: "front" | "back") => void;
  partitionCount: number;
  lockedPartitionCount: number;
  lockAllPartitions: () => void;
  unlockAllPartitions: () => void;
};

export function WorkspacePlacementPanel({
  autoAddTopLightstrip,
  setAutoAddTopLightstrip,
  selectedWallFace,
  spawnLocation,
  selectedItem,
  roomSize,
  wallBatchSpacing,
  setWallBatchSpacing,
  wallBatchCount,
  setWallBatchCount,
  partitionAttachSide,
  setPartitionAttachSide,
  partitionCount,
  lockedPartitionCount,
  lockAllPartitions,
  unlockAllPartitions,
}: Props) {
  const { t } = useI18n();
  const activeFace = selectedWallFace || spawnLocation;
  const partitionLength = selectedItem?.type === "partition" ? Math.max(0.6, Math.abs(selectedItem.scale[0] || 1)) : null;
  const selectedFaceLength =
    activeFace === "north" || activeFace === "south"
      ? roomSize.width
      : activeFace === "east" || activeFace === "west"
        ? roomSize.length
        : Math.max(roomSize.width, roomSize.length);
  const baseLength = partitionLength ?? selectedFaceLength;
  const centerGap = Math.max(0.6, wallBatchSpacing);
  const maxBatchCount = Math.max(1, Math.floor(Math.max(0, baseLength - 1) / centerGap) + 1);
  const current = Math.min(wallBatchCount, maxBatchCount);

  return (
    <details className="mb-4 rounded-2xl border border-white/15 bg-white/8 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md" open>
      <summary className="cursor-pointer text-xs font-semibold text-white">{t('workspaceBatchPlacementTitle')}</summary>
      <div className="mt-2 space-y-2">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/6 px-3 py-2">
          <span className="text-xs font-medium leading-5 text-white/85">{t('workspaceAutoTopLightstrip')}</span>
          <input type="checkbox" checked={autoAddTopLightstrip} onChange={(e) => setAutoAddTopLightstrip(e.target.checked)} className="h-4 w-4 accent-indigo-400" />
        </label>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/85">
            {t('workspaceBatchCount')}
          </label>
          <span className="text-xs text-white/70">{current}</span>
        </div>
        <input type="range" min="1" max={maxBatchCount} step="1" value={current} onChange={(e) => setWallBatchCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="w-full accent-indigo-400" />

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/85">{t('workspaceCenterGap')}</label>
          <span className="text-xs text-white/70">{wallBatchSpacing.toFixed(1)}m</span>
        </div>
        <input type="range" min="0.6" max="4" step="0.1" value={wallBatchSpacing} onChange={(e) => setWallBatchSpacing(Math.max(0.6, Number(e.target.value) || 1.2))} className="w-full accent-indigo-400" />

        {selectedItem?.type === "partition" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPartitionAttachSide("front")} className={`rounded-md border px-2 py-1.5 text-xs ${partitionAttachSide === "front" ? "border-white/18 bg-white/14 text-white" : "border-white/12 bg-white/6 text-white/75"}`}>
              {t('workspacePartitionFront')}
            </button>
            <button onClick={() => setPartitionAttachSide("back")} className={`rounded-md border px-2 py-1.5 text-xs ${partitionAttachSide === "back" ? "border-white/18 bg-white/14 text-white" : "border-white/12 bg-white/6 text-white/75"}`}>
              {t('workspacePartitionBack')}
            </button>
          </div>
        )}

        <p className="text-[11px] text-white/70">
          {selectedWallFace
            ? t('workspaceBatchHintOnWall', { target: selectedItem?.type === "partition" ? t('workspacePartitionWall') : t('workspaceCurrentWall') })
            : t('workspaceBatchHintDefault')}
        </p>

        <div className="mt-3 rounded-xl border border-white/12 bg-white/6 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">{t('workspacePartitionLockTitle')}</p>
              <p className="text-[11px] text-white/70">{t('workspacePartitionLockStatus', { partitionCount: String(partitionCount), lockedPartitionCount: String(lockedPartitionCount) })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={lockAllPartitions}
              disabled={partitionCount === 0 || lockedPartitionCount === partitionCount}
              className="rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('workspaceLockAll')}
            </button>
            <button
              type="button"
              onClick={unlockAllPartitions}
              disabled={partitionCount === 0 || lockedPartitionCount === 0}
              className="rounded-md border border-white/12 bg-white/8 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('workspaceUnlockAll')}
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}
