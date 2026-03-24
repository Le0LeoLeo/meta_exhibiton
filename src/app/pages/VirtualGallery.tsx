import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Play, Grid, Palette, Maximize2, Users, BarChart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createGallery, getGalleryById, loadAuth } from '../api/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { GALLERY_TEMPLATES } from '../constants/galleryTemplates';
import { getTemplateSceneJson } from '../constants/gallerySceneTemplates';

export default function VirtualGallery() {
  const navigate = useNavigate();
  const { token } = loadAuth();

  const handleStartCreate = () => {
    if (token) {
      navigate('/virtual-gallery/my-exhibitions');
    } else {
      navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
    }
  };

  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinGalleryId, setJoinGalleryId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  const handleJoinExhibition = async () => {
    const id = joinGalleryId.trim();
    if (!id) {
      toast.error('請先輸入展覽 ID');
      return;
    }

    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}`));
      return;
    }

    try {
      await getGalleryById(token, id);
      setJoinOpen(false);
      navigate(
        `/virtual-gallery/create?exhibitionId=${encodeURIComponent(id)}&roomId=${encodeURIComponent(`gallery:${id}`)}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '找不到此展覽';
      toast.error('無法加入展覽', { description: message });
    }
  };

  const categories = ['全部', ...Array.from(new Set(GALLERY_TEMPLATES.map((t) => t.category)))];

  const handleUseTemplate = async (template: (typeof GALLERY_TEMPLATES)[number]) => {
    setSelectedTemplate(template.title);

    if (!token) {
      navigate('/login?returnTo=' + encodeURIComponent('/virtual-gallery/my-exhibitions'));
      return;
    }

    setIsCreatingFromTemplate(true);
    try {
      const sceneJson = getTemplateSceneJson(template.title);

      const result = await createGallery(token, {
        title: template.title,
        description: template.description,
        templateTitle: template.title,
        templateImage: template.image,
        category: template.category,
        ...(sceneJson ? { sceneJson } : {}),
      });

      toast.success(`已使用「${template.title}」模板`, { description: '正在進入編輯器...' });
      navigate(`/virtual-gallery/create?exhibitionId=${encodeURIComponent(result.gallery.id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '使用模板失敗';
      toast.error('建立模板展覽失敗', { description: message });
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  const filtered = selectedCategory === '全部'
    ? GALLERY_TEMPLATES.filter((t) => t.title !== '空白展覽')
    : GALLERY_TEMPLATES.filter((t) => t.title !== '空白展覽' && t.category === selectedCategory);

  const features = [
    { icon: Grid, title: '多樣化模板', description: '多種專業設計的3D展廳模板可供選擇' },
    { icon: Palette, title: '完全自訂化', description: '自由調整材質、燈光、佈局等所有元素' },
    { icon: Maximize2, title: '彈性空間', description: '不受物理限制，創建各種規模的虛擬展廳' },
    { icon: Users, title: '多人協作', description: '團隊成員可同時編輯和設計展廳' },
    { icon: BarChart, title: '數據洞察', description: '追蹤訪客動線和停留熱點' },
    { icon: Play, title: '即時預覽', description: 'VR模式即時體驗展廳效果' },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.h1
              className="text-5xl mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              虛擬展廳
            </motion.h1>
            <motion.p
              className="text-xl mb-8 text-purple-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              選擇專業模板或從零開始，打造獨一無二的3D虛擬展覽空間
            </motion.p>
            <motion.div
              className="flex justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg"
                  onClick={handleStartCreate}
                >
                  開始創建
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg"
                  onClick={() => setJoinOpen(true)}
                >
                  <Play className="size-5 mr-2" />
                  加入
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-3xl text-center text-gray-900 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            功能特色
          </motion.h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.03, y: -5 }}
              >
                <motion.div 
                  className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  whileHover={{ rotate: 10 }}
                >
                  <feature.icon className="size-6 text-purple-600" />
                </motion.div>
                <h3 className="text-lg text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Templates Gallery */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl text-gray-900 mb-4">精選展廳模板</h2>
            <p className="text-gray-600 mb-8">從模板庫中選擇，快速啟動您的虛擬展覽</p>
          </motion.div>

          {/* Category Filter */}
          <motion.div 
            className="flex justify-center gap-3 mb-10 flex-wrap"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {categories.map((cat) => (
              <motion.button
                key={cat}
                className={`px-5 py-2 rounded-full text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedCategory(cat)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {cat}
              </motion.button>
            ))}
          </motion.div>

          <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filtered.map((template) => (
                <motion.div
                  key={template.title}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="group cursor-pointer"
                  whileHover={{ y: -8 }}
                >
                  <div className="relative overflow-hidden rounded-xl mb-4">
                    <ImageWithFallback
                      src={template.image}
                      alt={template.title}
                      className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <Button
                        className="w-full bg-white text-purple-600 hover:bg-gray-100"
                        disabled={isCreatingFromTemplate}
                        onClick={() => {
                          void handleUseTemplate(template);
                        }}
                      >
                        {isCreatingFromTemplate && selectedTemplate === template.title ? '建立中...' : '使用此模板'}
                      </Button>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                        {template.category}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg text-gray-900 mb-1">{template.title}</h3>
                  <p className="text-sm text-gray-600">{template.description}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <motion.div
        className="bg-purple-50 py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            className="text-3xl text-gray-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            準備好創建您的虛擬展廳了嗎？
          </motion.h2>
          <motion.p
            className="text-gray-600 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            註冊即可開始建立您的展廳
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            <Link to="/register">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg">
                立即開始
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Join Exhibition Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>加入別人的展覽</DialogTitle>
            <DialogDescription>請輸入對方分享給你的展覽 ID。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-gray-700">展覽 ID</label>
            <Input
              value={joinGalleryId}
              onChange={(e) => setJoinGalleryId(e.target.value)}
              placeholder="例如：c96a39b9-85d1-4207-a71e-636338c7ba1a"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleJoinExhibition();
                }
              }}
            />
            <p className="text-xs text-gray-500">輸入後將直接進入該展覽（若你有權限存取）。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>
              取消
            </Button>
            <Button onClick={handleJoinExhibition}>加入展覽</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}