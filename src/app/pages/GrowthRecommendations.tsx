import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Compass, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { getMyGrowthRecommendations, loadAuth, type GrowthRecommendation } from '../api/client';

const modeOptions = [
  { id: 'explore', label: '探索型' },
  { id: 'guide', label: '導覽型' },
  { id: 'story', label: '故事型' },
];
const interestOptions = [
  { id: 'story', label: '敘事回顧' },
  { id: 'media', label: '照片影片' },
  { id: 'social', label: '親友互動' },
];
const depthOptions = [
  { id: 'fast', label: '快速' },
  { id: 'balanced', label: '平衡' },
  { id: 'deep', label: '深度' },
];

function RouteCard({ route, onOpen }: { route: GrowthRecommendation; onOpen: (route: string) => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-sky-600">{route.routeType}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{route.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{route.reason}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-3 py-2 text-right text-white">
          <p className="text-xs text-slate-300">分數</p>
          <p className="text-2xl font-semibold">{route.score}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <span className="rounded-2xl bg-slate-50 px-3 py-2">素材 {route.assetCount}</span>
        <span className="rounded-2xl bg-slate-50 px-3 py-2">留言 {route.commentCount}</span>
        <span className="rounded-2xl bg-slate-50 px-3 py-2">主題 {route.templateId}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => onOpen(route.route)}>
          開始這條路線 <ArrowRight className="ml-2 size-4" />
        </Button>
        <Link to={route.route} className="text-sm font-medium text-sky-700 hover:text-sky-800">
          直接前往 3D 展廳
        </Link>
      </div>
    </div>
  );
}

export default function GrowthRecommendationsPage() {
  const [routes, setRoutes] = useState<GrowthRecommendation[]>([]);
  const [route, setRoute] = useState<GrowthRecommendation | null>(null);
  const [mode, setMode] = useState('explore');
  const [interest, setInterest] = useState('story');
  const [depth, setDepth] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const { token } = loadAuth();
    if (!token) return toast.error('請先登入');
    setLoading(true);
    try {
      const res = await getMyGrowthRecommendations(token, { mode, interest, depth });
      setRoute(res.route);
      setRoutes(res.routes);
    } catch (err) {
      toast.error('載入推薦路線失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mode, interest, depth]);

  const topRoutes = useMemo(() => routes.slice(0, 6), [routes]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_25%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-sky-700"><Sparkles className="size-3.5" /> Personal route hub</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">個人化推薦路線中心</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">依照你的展館素材、留言互動與偏好設定，自動排序最值得先看的成長路線，並提供快速切換的導覽風格。</p>
            </div>
            <Button variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={load} disabled={loading}>
              <SlidersHorizontal className="mr-2 size-4" /> 重新計算
            </Button>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>路線數</CardTitle><CardDescription>{routes.length} 條可用路線</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle>最佳分數</CardTitle><CardDescription>{route?.score ?? 0}</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle>當前模式</CardTitle><CardDescription>{mode} / {interest} / {depth}</CardDescription></CardHeader></Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-950">推薦偏好</h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">模式</p>
                  <div className="flex flex-wrap gap-2">
                    {modeOptions.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={`rounded-full px-3 py-2 text-sm ${mode === item.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-700'}`}>{item.label}</button>)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">興趣</p>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((item) => <button key={item.id} onClick={() => setInterest(item.id)} className={`rounded-full px-3 py-2 text-sm ${interest === item.id ? 'bg-sky-600 text-white' : 'bg-white text-sky-700'}`}>{item.label}</button>)}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">深度</p>
                  <div className="flex flex-wrap gap-2">
                    {depthOptions.map((item) => <button key={item.id} onClick={() => setDepth(item.id)} className={`rounded-full px-3 py-2 text-sm ${depth === item.id ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700'}`}>{item.label}</button>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {topRoutes.map((r) => <RouteCard key={r.exhibitId} route={r} onOpen={(path) => navigate(path)} />)}
              {topRoutes.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">還沒有足夠資料產生路線，先到成長記憶頁建立一些素材。</div>}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
