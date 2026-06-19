import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Baby, BookOpenText, Clock3, Eye, FileEdit, Film, Lock, Rocket, Share2, Sparkles, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GrowthGalleryPreview } from '../components/GrowthGalleryPreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  createGrowthAsset,
  createGrowthChild,
  createGrowthComment,
  createGrowthExhibit,
  createGrowthShareLink,
  getGrowthAssetsByExhibit,
  getGrowthCommentsByExhibit,
  getMyGrowthChildren,
  getMyGrowthExhibits,
  getMyGrowthRecommendations,
  loadAuth,
  type GrowthAsset,
  type GrowthChild,
  type GrowthComment,
  type GrowthExhibit,
  type GrowthRecommendation,
} from '../api/client';

const templates = [
  { id: 'newborn', name: '新生初遇', desc: '適合 0-1 歲，紀錄第一次微笑與第一聲啼哭。', vibe: '柔和奶油色系' },
  { id: 'birthday', name: '生日星球', desc: '把每年生日變成可回放的 3D 祝福派對。', vibe: '繽紛高飽和' },
  { id: 'school', name: '入學紀念', desc: '收錄學校生活、作品與成長里程碑。', vibe: '清新書卷感' },
];

const recommendationModes = [
  { id: 'explore', label: '探索型' },
  { id: 'guide', label: '導覽型' },
  { id: 'story', label: '故事型' },
];

const recommendationInterests = [
  { id: 'story', label: '敘事回顧' },
  { id: 'media', label: '照片影片' },
  { id: 'social', label: '親友互動' },
];

const recommendationDepths = [
  { id: 'fast', label: '快速' },
  { id: 'balanced', label: '平衡' },
  { id: 'deep', label: '深度' },
];

function SectionCard({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border border-slate-200/80 bg-white/85 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-5">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">{icon}</span>
          {title}
        </CardTitle>
        <CardDescription className="text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function RecommendationCard({ recommendation }: { recommendation: GrowthRecommendation | null }) {
  if (!recommendation) return null;
  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4 text-slate-800">
      <p className="text-[11px] uppercase tracking-[0.24em] text-sky-600">個人化推薦路線</p>
      <h4 className="mt-2 text-lg font-semibold text-slate-950">{recommendation.title}</h4>
      <p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.reason}</p>
    </div>
  );
}

export default function GrowthMemories() {
  const [childName, setChildName] = useState('');
  const [birthday, setBirthday] = useState('2025-01-01');
  const [selectedTemplate, setSelectedTemplate] = useState('newborn');
  const [story, setStory] = useState('今天我們一起建立第一座專屬於孩子的線上成長展覽館。');
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedExhibitId, setSelectedExhibitId] = useState('');
  const [children, setChildren] = useState<GrowthChild[]>([]);
  const [exhibits, setExhibits] = useState<GrowthExhibit[]>([]);
  const [assets, setAssets] = useState<GrowthAsset[]>([]);
  const [comments, setComments] = useState<GrowthComment[]>([]);
  const [recommendation, setRecommendation] = useState<GrowthRecommendation | null>(null);
  const [recommendationRoutes, setRecommendationRoutes] = useState<GrowthRecommendation[]>([]);
  const [assetTitle, setAssetTitle] = useState('');
  const [assetType, setAssetType] = useState<GrowthAsset['type']>('photo');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetNote, setAssetNote] = useState('');
  const [assetDate, setAssetDate] = useState('');
  const [commentUserName, setCommentUserName] = useState('家人');
  const [commentContent, setCommentContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [editorMode, setEditorMode] = useState<'curate' | 'preview' | 'share'>('curate');
  const [prefMode, setPrefMode] = useState('explore');
  const [prefInterest, setPrefInterest] = useState('story');
  const [prefDepth, setPrefDepth] = useState('balanced');
  const navigate = useNavigate();
  const selected = useMemo(() => templates.find((t) => t.id === selectedTemplate) ?? templates[0], [selectedTemplate]);
  const selectedExhibit = useMemo(() => exhibits.find((e) => e.id === selectedExhibitId) ?? null, [exhibits, selectedExhibitId]);

  const loadData = async () => {
    const { token } = loadAuth();
    if (!token) return;
    try {
      const [childrenRes, exhibitsRes, recommendRes] = await Promise.all([
        getMyGrowthChildren(token),
        getMyGrowthExhibits(token),
        getMyGrowthRecommendations(token, { mode: prefMode, interest: prefInterest, depth: prefDepth }),
      ]);
      setChildren(childrenRes.children);
      setExhibits(exhibitsRes.exhibits);
      setRecommendation(recommendRes.route);
      setRecommendationRoutes(recommendRes.routes);
      if (!selectedChildId && childrenRes.children[0]?.id) setSelectedChildId(childrenRes.children[0].id);
      if (!selectedExhibitId && exhibitsRes.exhibits[0]?.id) setSelectedExhibitId(exhibitsRes.exhibits[0].id);
    } catch (err) {
      toast.error('載入成長紀念資料失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    }
  };

  const loadExhibitDetails = async (exhibitId: string) => {
    const { token } = loadAuth();
    if (!token || !exhibitId) return;
    try {
      const [assetsRes, commentsRes] = await Promise.all([getGrowthAssetsByExhibit(token, exhibitId), getGrowthCommentsByExhibit(token, exhibitId)]);
      setAssets(assetsRes.assets);
      setComments(commentsRes.comments);
    } catch (err) {
      toast.error('載入展館內容失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    }
  };

  useEffect(() => { loadData(); }, [prefMode, prefInterest, prefDepth]);
  useEffect(() => { if (selectedExhibitId) loadExhibitDetails(selectedExhibitId); else { setAssets([]); setComments([]); } }, [selectedExhibitId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f3f4f6_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="rounded-[32px] border border-white/70 bg-white/75 p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.55)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap gap-3">
            {recommendationModes.map((item) => (
              <button key={item.id} onClick={() => setPrefMode(item.id)} className={`rounded-full px-4 py-2 text-sm ${prefMode === item.id ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'}`}>{item.label}</button>
            ))}
            {recommendationInterests.map((item) => (
              <button key={item.id} onClick={() => setPrefInterest(item.id)} className={`rounded-full px-4 py-2 text-sm ${prefInterest === item.id ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700'}`}>{item.label}</button>
            ))}
            {recommendationDepths.map((item) => (
              <button key={item.id} onClick={() => setPrefDepth(item.id)} className={`rounded-full px-4 py-2 text-sm ${prefDepth === item.id ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>{item.label}</button>
            ))}
          </div>
          <div className="mt-4">
            <RecommendationCard recommendation={recommendation} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {recommendationRoutes.slice(0, 3).map((item) => (
              <button key={item.exhibitId} onClick={() => navigate(item.route)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-slate-500">{item.routeType} · 分數 {item.score}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
