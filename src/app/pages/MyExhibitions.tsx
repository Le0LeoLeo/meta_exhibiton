import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Plus, Pencil, Calendar, ArrowRight, Loader2, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { createGallery, deleteGalleryById, getMyGalleries, loadAuth, type GallerySummary } from '../api/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CREATE_GALLERY_TEMPLATE_TITLES, GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';

export default function MyExhibitions() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GallerySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareGalleryId, setShareGalleryId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGallery, setDeleteGallery] = useState<GallerySummary | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState('空白展覽');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const createTemplates = GALLERY_TEMPLATES.filter((template) =>
    CREATE_GALLERY_TEMPLATE_TITLES.includes(template.title as (typeof CREATE_GALLERY_TEMPLATE_TITLES)[number]),
  );

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [items],
  );

  const fetchMyExhibitions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { token } = loadAuth();
      if (!token) {
        navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
        return;
      }

      const result = await getMyGalleries(token);
      setItems(Array.isArray(result.galleries) ? result.galleries : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '載入展覽列表失敗';
      setError(message);
      toast.error('無法載入你的展覽', { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyExhibitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNew = () => {
    setNewTitle('');
    setSelectedTemplateTitle('空白展覽');
    setCreateOpen(true);
  };

  const handleConfirmCreate = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error('請輸入展覽名稱');
      return;
    }

    const selectedTemplate = createTemplates.find((t) => t.title === selectedTemplateTitle) ?? createTemplates[0];

    setIsCreating(true);
    try {
      const { token } = loadAuth();
      if (!token) {
        navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
        return;
      }

      const sceneJson = getTemplateSceneJson(selectedTemplate.title);

      const result = await createGallery(token, {
        title,
        description: selectedTemplate.description,
        templateTitle: selectedTemplate.title,
        templateImage: selectedTemplate.image,
        category: selectedTemplate.category,
        ...(sceneJson ? { sceneJson } : {}),
      });

      setCreateOpen(false);
      toast.success('已建立新展覽', { description: `「${title}」（模板：${selectedTemplate.title}）` });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '建立展覽失敗';
      toast.error('建立展覽失敗', { description: message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}`);
  };

  const handleShare = (id: string) => {
    setShareGalleryId(id);
    setShareOpen(true);
  };

  const handleOpenDelete = (gallery: GallerySummary) => {
    setDeleteGallery(gallery);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteGallery) return;

    setIsDeleting(true);
    try {
      const { token } = loadAuth();
      if (!token) {
        navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
        return;
      }

      await deleteGalleryById(token, deleteGallery.id);
      setItems((prev) => prev.filter((g) => g.id !== deleteGallery.id));
      setDeleteOpen(false);
      toast.success('已刪除展覽', { description: `「${deleteGallery.title}」` });
      setDeleteGallery(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '刪除展覽失敗';
      toast.error('刪除展覽失敗', { description: message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyEditShare = async () => {
    if (!shareGalleryId) return;
    const text = `${window.location.origin}/virtual-gallery/create?exhibitionId=${encodeURIComponent(shareGalleryId)}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已複製編輯分享連結');
    } catch {
      toast.error('複製失敗', { description: '請手動複製連結。' });
    }
  };

  const handleCopyViewShare = async () => {
    if (!shareGalleryId) return;
    const text = `${window.location.origin}/virtual-gallery/create?exhibitionId=${encodeURIComponent(shareGalleryId)}&share=view`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已複製展覽分享連結（僅觀展）');
    } catch {
      toast.error('複製失敗', { description: '請手動複製連結。' });
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-4xl text-slate-900 mb-3">你的展覽</h1>
          <p className="text-slate-600">你可以建立全新展覽，或繼續編輯之前的展覽內容。</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl text-slate-900 mb-1">建立新展覽</h2>
              <p className="text-slate-600">從空白場景開始，快速打造新的虛擬展覽空間。</p>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleCreateNew}>
              <Plus className="size-4 mr-2" />
              開新展覽
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl text-slate-900">編輯既有展覽</h2>
              <p className="text-slate-600 mt-1">選擇你先前建立的展覽，接續編輯。</p>
            </div>
            <Button variant="outline" onClick={fetchMyExhibitions} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
              重新整理
            </Button>
          </div>

          {isLoading ? (
            <div className="p-8 text-slate-500 flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              載入展覽中...
            </div>
          ) : error ? (
            <div className="p-8 text-red-500">{error}</div>
          ) : sortedItems.length === 0 ? (
            <div className="p-6 text-slate-500">目前還沒有既有展覽，先建立你的第一個展覽吧！</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedItems.map((item) => (
                <div key={item.id} className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-28 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0">
                      <ImageWithFallback
                        src={item.templateImage || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg text-slate-900 truncate">{item.title}</p>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <Calendar className="size-4" />
                        最後更新：{new Date(item.updatedAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={() => handleShare(item.id)}>
                      <Share2 className="size-4 mr-2" />
                      分享
                    </Button>
                    <Button variant="outline" onClick={() => handleEdit(item.id)}>
                      <Pencil className="size-4 mr-2" />
                      編輯展覽
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleOpenDelete(item)}>
                      <Trash2 className="size-4 mr-2" />
                      刪除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>分享展覽</DialogTitle>
              <DialogDescription>可選擇「可編輯」或「僅觀展」兩種分享模式。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Button className="w-full justify-start" variant="outline" onClick={handleCopyEditShare}>
                複製編輯分享連結（可編輯）
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handleCopyViewShare}>
                複製展覽分享連結（僅觀展）
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareOpen(false)}>
                關閉
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>刪除展覽</DialogTitle>
              <DialogDescription>
                你確定要刪除「{deleteGallery?.title || '此展覽'}」嗎？此操作無法復原。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                取消
              </Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? '刪除中...' : '確認刪除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>建立新展覽</DialogTitle>
              <DialogDescription>請先輸入展覽名稱，並選擇模板後再進入編輯器。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-700">展覽名稱</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：2026 春季品牌展"
                  maxLength={120}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleConfirmCreate();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-700">選擇模板</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {createTemplates.map((template) => {
                    const isSelected = selectedTemplateTitle === template.title;
                    return (
                      <button
                        key={template.title}
                        type="button"
                        className={`text-left rounded-xl border overflow-hidden transition-all ${
                          isSelected
                            ? 'border-purple-500 ring-2 ring-purple-200 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => setSelectedTemplateTitle(template.title)}
                        disabled={isCreating}
                      >
                        <div className="h-28 bg-slate-100">
                          <ImageWithFallback src={template.image} alt={template.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm text-slate-900">{template.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{template.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
                取消
              </Button>
              <Button onClick={handleConfirmCreate} disabled={isCreating}>
                {isCreating ? '建立中...' : '建立並開始編輯'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
