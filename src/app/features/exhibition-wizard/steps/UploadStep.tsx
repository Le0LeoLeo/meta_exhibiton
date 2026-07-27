import { useId, useState } from "react";
import { Trash2 } from "lucide-react";

import { deleteMediaAsset, uploadMediaAsset } from "@/app/api/media";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { RosterImportPanel } from "../import";
import type { ExhibitionWizardSlotContext } from "../ExhibitionWizard";

type UploadStepProps = ExhibitionWizardSlotContext & {
  token: string | null;
  onRequireAuth: () => void;
};

export function UploadStep({ draft, patch, token, onRequireAuth }: UploadStepProps) {
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [rosterCount, setRosterCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function removeAsset(assetId: string, persisted: boolean) {
    if (persisted && !token) {
      onRequireAuth();
      return;
    }
    setDeleteError(null);
    setDeletingId(assetId);
    try {
      if (persisted && token) await deleteMediaAsset(token, assetId);
      patch({ assets: draft.assets.filter((asset) => asset.id !== assetId) });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "無法移除素材");
    } finally {
      setDeletingId(null);
    }
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    if (!token) {
      onRequireAuth();
      return;
    }

    setIsUploading(true);
    const pending = files.map((file, index) => ({
      id: `pending-${Date.now()}-${index}`,
      fileName: file.name,
      mimeType: file.type,
      status: "uploading" as const,
    }));
    patch({ assets: [...draft.assets, ...pending] });

    const uploaded = await Promise.all(files.map(async (file, index) => {
      try {
        const asset = await uploadMediaAsset(token, file);
        return {
          id: asset.id,
          fileName: asset.originalFileName,
          mimeType: asset.mimeType,
          url: asset.url,
          previewUrl: asset.previewUrl,
          status: "succeeded" as const,
        };
      } catch (error) {
        return {
          ...pending[index],
          status: "failed" as const,
          error: error instanceof Error ? error.message : "上傳失敗",
        };
      }
    }));

    patch({ assets: [...draft.assets, ...uploaded] });
    setIsUploading(false);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg border border-border p-4">
        <Label htmlFor={inputId}>上傳作品</Label>
        <Input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          disabled={isUploading}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            void uploadFiles(files);
            event.currentTarget.value = "";
          }}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          支援 JPEG、PNG及 WebP；系統會檢查檔案內容並移除圖片定位資料。
        </p>
        <div className="space-y-2" aria-live="polite">
          {draft.assets.map((asset) => (
            <div key={asset.id} className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{asset.fileName}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className={asset.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                  {asset.status === "uploading" ? "上傳中" : asset.status === "succeeded" ? "已上傳" : asset.status === "failed" ? asset.error : "等待中"}
                </span>
                {asset.status !== "uploading" ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="min-h-11 min-w-11"
                    disabled={deletingId === asset.id}
                    aria-label={`移除 ${asset.fileName}`}
                    onClick={() => void removeAsset(asset.id, asset.status === "succeeded")}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
      </div>

      <RosterImportPanel
        onImport={(rows) => {
          const byFileName = new Map(rows.map((row) => [row.fileName.toLocaleLowerCase(), row]));
          patch({
            assets: draft.assets.map((asset) => {
              const row = byFileName.get(asset.fileName.toLocaleLowerCase());
              return row ? {
                ...asset,
                studentCode: row.studentCode,
                title: row.workTitle,
                authorDisplayName: row.authorDisplayName,
                description: row.description,
              } : asset;
            }),
          });
          setRosterCount(rows.length);
        }}
      />
      {rosterCount > 0 ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          已匯入 {rosterCount} 筆作品資料，並按檔名配對已上傳素材。
        </p>
      ) : null}

      {!token ? (
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onRequireAuth}>
          登入後上傳作品
        </Button>
      ) : null}
    </div>
  );
}
