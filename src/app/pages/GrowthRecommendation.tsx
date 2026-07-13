import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Brain, Clock3, Compass, Sparkles, Target, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getMyGrowthRecommendations, loadAuth, type GrowthRecommendation } from '../api/client';
import { useI18n } from '../components/I18nProvider';

function RecommendationCard({ recommendation, t }: { recommendation: GrowthRecommendation | null; t: (key: string, values?: Record<string, string | number>) => string }) {
  if (!recommendation) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-slate-500">
        {t('gr.no_recommendation')}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.5)]">
      <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
        <Sparkles className="size-4" /> {t('gr.best_recommendation')}
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">{recommendation.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{recommendation.reason}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t('gr.score')} value={String(recommendation.score)} />
        <Metric label={t('gr.asset_count')} value={String(recommendation.assetCount)} />
        <Metric label={t('gr.comment_count')} value={String(recommendation.commentCount)} />
        <Metric label={t('gr.route_type')} value={recommendation.routeType} />
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

function RecommendationList({ routes, onNavigate, t }: { routes: GrowthRecommendation[]; onNavigate: (route: string) => void; t: (key: string, values?: Record<string, string | number>) => string }) {
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
                <Target className="size-3.5" /> {t('gr.route_number', { n: index + 1 })}
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{item.score}</div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-50 px-3 py-1">{item.childName}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">{item.routeType}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">{t('gr.asset')} {item.assetCount}</span>
            <span className="rounded-full bg-slate-50 px-3 py-1">{t('gr.comment')} {item.commentCount}</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
            {t('gr.go_to_exhibit')}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default function GrowthRecommendationPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const modeOptions = useMemo(() => [
    { value: 'explore', label: t('gr.mode_explore'), description: t('gr.mode_explore_desc') },
    { value: 'guide', label: t('gr.mode_guide'), description: t('gr.mode_guide_desc') },
    { value: 'story', label: t('gr.mode_story'), description: t('gr.mode_story_desc') },
  ], [t]);

  const interestOptions = useMemo(() => [
    { value: 'story', label: t('gr.interest_story') },
    { value: 'media', label: t('gr.interest_media') },
    { value: 'social', label: t('gr.interest_social') },
  ], [t]);

  const depthOptions = useMemo(() => [
    { value: 'fast', label: t('gr.depth_fast') },
    { value: 'balanced', label: t('gr.depth_balanced') },
    { value: 'deep', label: t('gr.depth_deep') },
  ], [t]);

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
  }, [mode, interest, depth, modeOptions, interestOptions, depthOptions]);

  const loadRecommendations = async () => {
    const { token } = loadAuth();
    if (!token) {
      toast.error(t('gr.please_login'));
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
      toast.error(t('gr.load_failed'), { description: err instanceof Error ? err.message : t('gr.unknown_error') });
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
                <Compass className="size-3.5" /> {t('gr.personalized_route')}
              </div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">{t('gr.page_title')}</CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-slate-600">
                {t('gr.page_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white">
                    <SelectValue placeholder={t('gr.recommendation_mode')} />
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
                    <SelectValue placeholder={t('gr.preferred_topic')} />
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
                    <SelectValue placeholder={t('gr.watch_depth')} />
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
                {t('gr.current_combination')}<span className="font-medium text-slate-900"> {selectedLabel}</span>
              </div>

              <RecommendationCard recommendation={route} t={t} />

              <div className="flex flex-wrap gap-3">
                <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => navigate(route?.route || '/growth-memories')} disabled={!route || loading}>
                  <Brain className="mr-2 size-4" /> {t('gr.go_best_route')}
                </Button>
                <Button variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => navigate('/growth-memories')}>
                  {t('gr.back_to_memories')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Clock3 className="size-5" /> {t('gr.recommendation_order')}
                </CardTitle>
                <CardDescription>{t('gr.sort_description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RecommendationList routes={routes.slice(0, 4)} onNavigate={(path) => navigate(path)} t={t} />
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Target className="size-5" /> {t('gr.navigation_tips')}
                </CardTitle>
                <CardDescription>{t('gr.nav_tips_description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-slate-600">
                <p>{t('gr.tip_fast_mode')}</p>
                <p>{t('gr.tip_guide_mode')}</p>
                <p>{t('gr.tip_deep_mode')}</p>
                <p>{t('gr.tip_click_card')}</p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white/90 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Sparkles className="size-5" /> {t('gr.current_focus')}
                </CardTitle>
                <CardDescription>{t('gr.focus_description')}</CardDescription>
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
