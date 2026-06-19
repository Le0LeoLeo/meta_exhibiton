import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Brain, Clock3, Compass, Sparkles, Target, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getMyGrowthRecommendations, loadAuth, type GrowthRecommendation } from '../api/client';

const modeOptions = [
  { value: 'explore', label: '探索型', description: '快速找到今天最值得看的路線' },
  { value: 'guide', label: '導覽型', description: '更完整的內容脈絡與導覽節奏' },
  { value: 'story', label: '故事型', description: '強化情感與敘事回顧' },
];

const interestOptions = [
  { value: 'story', label: '敘事回顧' },
  { value: 'media', label: '照片影片' },
  { value: 'social', label: '親友互動' },
];

const depthOptions = [
  { value: 'fast', label: '快速' },
  { value: 'balanced', label: '平衡' },
  { value: 'deep', label: '深度' },
];

function RecommendationCard({ recommendation }: { recommendation: GrowthRecommendation | null }) {
  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-slate-500">
        尚未找到推薦路線，先建立幾個成長展館或新增素材。
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.5)]">
      <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
        <Sparkles className="size-4" /> 目前最佳推薦
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">{recommendation.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{recommendation.reason}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="推薦分數" value={String(recommendation.score)} />
        <Metric label="素材數" value={String(recommendation.assetCount)} />
        <Metric label="留言數" value={String(recommendation.commentCount)} />
        <Metric label="推薦類型" value={recommendation.routeType} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function RecommendationList({ routes, onNavigate }: { routes: GrowthRecommendation[]; onNavigate: (route: string) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {routes.map((item, index) => (
        <button
          key={item.exhibitId}
          type="button"
          onClick={() => onNavigate(item.route)}
          className="group rounded-3xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                <Target className="size-3.5" /> 路線 #{index + 1}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{item.score}</div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-50 px-3 py-1">{item.childName}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">{item.routeType}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">素材 {item.assetCount}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">留言 {item.commentCount}</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
            前往展廳
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default function GrowthRecommendationPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('explore');
  const [interest, setInterest] = useState('story');
  const [depth, setDepth] = useState('balanced');
  const [route, setRoute] = useState<GrowthRecommendation | null>(null);
  const [routes, setRoutes] = useState<GrowthRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusExhibitId, setFocusExhibitId] = useState('');

  const selectedLabel = useMemo(() => {
    const modeLabel = modeOptions.find((item) => item.value === mode)?.label ?? mode;
    const interestLabel = interestOptions.find((item) => item.value === interest)?.label ?? interest;
    const depthLabel = depthOptions.find((item) => item.value === depth)?.label ?? depth;
    return `${modeLabel} · ${interestLabel} · ${depthLabel}`;
  }, [mode, interest, depth]);

  const loadRecommendations = async () => {
    const { token } = loadAuth();
    if (!token) {
      toast.error('請先登入');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const data = await getMyGrowthRecommendations(token, { mode, interest, depth });
      setRoute(data.route);
      setRoutes(data.routes);
      setFocusExhibitId(data.route?.exhibitId ?? data.routes[0]?.exhibitId ?? '');
    } catch (err) {
      toast.error('載入推薦路線失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [mode, interest, depth]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.1),transparent_32%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden border border-white/70 bg-white/80 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.55)] backdrop-blur-xl">
            <CardHeader className="space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium tracking-[0.24em] text-sky-700 uppercase">
                <Compass className="size-3.5" /> Personalized Route
              </div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">個人化推薦路線</CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-slate-600">
                依照你的偏好、互動深度與展館活動狀態，自動挑出最適合先看的成長展館。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="推薦模式" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={interest} onValueChange={setInterest}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="偏好主題" />
                  </SelectTrigger>
                  <SelectContent>
                    {interestOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={depth} onValueChange={setDepth}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder="觀看深度" />
                  </SelectTrigger>
                  <SelectContent>
                    {depthOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Wand2 className="size-4 text-slate-500" />
                目前組合：<span className="font-medium text-slate-900">{selectedLabel}</span>
              </div>

              <RecommendationCard recommendation={route} />

              <div className="flex flex-wrap gap-3">
                <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => navigate(route?.route || '/growth-memories')} disabled={!route || loading}>
                  <Brain className="mr-2 size-4" /> 前往最佳路線
                </Button>
                <Button variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => navigate('/growth-memories')}>
                  返回成長紀念管理
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Clock3 className="size-5" /> 推薦排序
                </CardTitle>
                <CardDescription>系統會根據互動、素材與最新活動自動排序。</CardDescription>
              </CardHeader>
              <CardContent>
                <RecommendationList routes={routes.slice(0, 4)} onNavigate={(path) => navigate(path)} />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Target className="size-5" /> 導覽提示
                </CardTitle>
                <CardDescription>讓推薦結果更容易轉換成真正的逛展路線。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                <p>• 快速模式適合第一次打開的人，會優先推素材完整且易理解的展館。</p>
                <p>• 導覽型模式會拉高故事脈絡與互動密度的權重。</p>
                <p>• 深度模式會偏向留言多、內容更完整的回顧型路線。</p>
                <p>• 點選任一推薦卡片即可直接進入對應 3D 展廳。</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Sparkles className="size-5" /> 當前焦點
                </CardTitle>
                <CardDescription>可用來對照目前推薦命中的展館。</CardDescription>
              </CardHeader>
              <CardContent>
                <Input value={focusExhibitId} readOnly className="rounded-2xl border-slate-200 bg-slate-50" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
