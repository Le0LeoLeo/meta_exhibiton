import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { GrowthGalleryPreview } from '../components/GrowthGalleryPreview';
import { getGrowthAssetsByExhibit, loadAuth, type GrowthAsset } from '../api/client';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function GrowthMemories3D() {
  const { exhibitId = '' } = useParams();
  const [assets, setAssets] = useState<GrowthAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAsset, setActiveAsset] = useState<GrowthAsset | null>(null);

  useEffect(() => {
    const run = async () => {
      const { token } = loadAuth();
      if (!token || !exhibitId) return;
      setLoading(true);
      try {
        const res = await getGrowthAssetsByExhibit(token, exhibitId);
        setAssets(res.assets);
      } catch (err) {
        toast.error('載入 3D 展館失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [exhibitId]);

  const stats = useMemo(
    () => [
      { label: '素材數', value: String(assets.length).padStart(2, '0') },
      { label: '模式', value: 'Immersive' },
    ],
    [assets.length],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f3f4f6_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border border-white/70 bg-white/75 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <CardHeader className="space-y-4 border-b border-slate-200/80 bg-white/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium tracking-[0.2em] text-sky-700 uppercase">
                  <Sparkles className="size-3.5" /> 3D 展廳
                </p>
                <CardTitle className="text-3xl tracking-tight text-slate-950">成長紀念館</CardTitle>
                <CardDescription className="mt-2 text-slate-500">
                  {loading ? '載入中...' : `已載入 ${assets.length} 個素材，可用 WASD 走動，點擊作品可放大檢視。`}
                </CardDescription>
              </div>
              <div className="flex gap-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><Eye className="size-4" /> 互動式 3D 預覽</span>
                <span>安靜、極簡、沉浸感</span>
              </div>
              <div className="h-[560px]">
                <GrowthGalleryPreview assets={assets} immersive onSelectAsset={setActiveAsset} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 size-4" /> 返回上一頁
          </Button>
          <div className="text-sm text-slate-500">選擇作品後會以對話框放大顯示。</div>
        </div>
      </div>

      <Dialog open={Boolean(activeAsset)} onOpenChange={(open) => !open && setActiveAsset(null)}>
        <DialogContent className="max-w-3xl border-slate-200 bg-white text-slate-900 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl tracking-tight text-slate-950">{activeAsset?.title}</DialogTitle>
          </DialogHeader>
          {activeAsset?.contentUrl ? (
            <div className="space-y-3">
              {activeAsset.type === 'photo' && (
                <img src={activeAsset.contentUrl} alt={activeAsset.title} className="max-h-[70vh] w-full rounded-2xl object-contain" />
              )}
              {activeAsset.type === 'video' && (
                <video src={activeAsset.contentUrl} controls className="max-h-[70vh] w-full rounded-2xl" />
              )}
              {activeAsset.type === 'audio' && <audio src={activeAsset.contentUrl} controls className="w-full" />}
              {activeAsset.type === 'text' && (
                <a href={activeAsset.contentUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  開啟文字內容
                </a>
              )}
              <p className="text-sm leading-6 text-slate-500">{activeAsset.note || '無額外說明'}</p>
            </div>
          ) : (
            <p className="text-slate-500">此素材無可預覽連結</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
