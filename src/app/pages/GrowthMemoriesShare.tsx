import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Camera, Clock3, MessageCircleHeart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  getSharedGrowthExhibit,
  getSharedGrowthAssets,
  getSharedGrowthComments,
  postSharedGrowthComment,
  type GrowthAsset,
  type GrowthComment,
  type GrowthExhibit,
} from '../api/client';

export default function GrowthMemoriesShare() {
  const { token = '' } = useParams();
  const [exhibit, setExhibit] = useState<GrowthExhibit | null>(null);
  const [assets, setAssets] = useState<GrowthAsset[]>([]);
  const [comments, setComments] = useState<GrowthComment[]>([]);
  const [userName, setUserName] = useState('親友');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [exhibitRes, assetsRes, commentsRes] = await Promise.all([
        getSharedGrowthExhibit(token),
        getSharedGrowthAssets(token),
        getSharedGrowthComments(token),
      ]);
      setExhibit(exhibitRes.exhibit);
      setAssets(assetsRes.assets);
      setComments(commentsRes.comments);
    } catch (err) {
      toast.error('載入分享頁失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handlePost = async () => {
    if (!token) return;
    if (!userName.trim() || !content.trim()) return toast.error('請填寫名字與留言內容');

    try {
      await postSharedGrowthComment(token, { userName: userName.trim(), content: content.trim() });
      setContent('');
      const commentsRes = await getSharedGrowthComments(token);
      setComments(commentsRes.comments);
      toast.success('留言成功');
    } catch (err) {
      toast.error('留言失敗', { description: err instanceof Error ? err.message : '未知錯誤' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
          <CardHeader>
            <CardTitle>{exhibit?.title || '成長紀念分享頁'}</CardTitle>
            <CardDescription className="text-slate-400">
              {loading ? '載入中...' : exhibit?.introStory || '歡迎來到孩子的成長展館'}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock3 className="size-5 text-cyan-300" /> 成長時光軸</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assets.length === 0 ? (
                <p className="text-slate-400">尚無素材</p>
              ) : (
                assets.map((asset) => (
                  <div key={asset.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                    <p>{asset.title}</p>
                    <p className="text-xs text-slate-400">{asset.type} · {asset.capturedAt || asset.createdAt}</p>
                    {asset.note && <p className="mt-1 text-sm text-slate-300">{asset.note}</p>}
                    {asset.contentUrl && (
                      <a href={asset.contentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-cyan-300 underline">
                        <Camera className="size-3.5" /> 查看素材
                      </a>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircleHeart className="size-5 text-emerald-300" /> 親友留言</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="你的名字" className="border-slate-700 bg-slate-950" />
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="寫下祝福..." className="border-slate-700 bg-slate-950" rows={3} />
              <Button onClick={handlePost} className="w-full">送出祝福</Button>

              <div className="space-y-2 pt-2">
                {comments.length === 0 ? (
                  <p className="text-slate-400">尚無留言</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                      <p className="text-sm">{comment.userName}</p>
                      <p className="mt-1 text-sm text-slate-300">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
