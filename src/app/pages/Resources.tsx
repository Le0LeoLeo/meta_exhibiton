import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BookOpen, Video, FileText, Code, Download, Clock, Search, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

export default function Resources() {
  const [searchQuery, setSearchQuery] = useState('');

  const tutorials = [
    { title: '快速入門指南', description: '10分鐘學會創建您的第一個虛擬展廳', duration: '10分鐘', type: '影片教學', icon: Video },
    { title: '進階3D建模技巧', description: '學習如何自訂展廳的每個細節', duration: '25分鐘', type: '影片教學', icon: Video },
    { title: 'VR模式設定教學', description: '設定並優化虛擬實境體驗', duration: '15分鐘', type: '影片教學', icon: Video },
    { title: '數據分析完整指南', description: '深入了解觀眾行為與展覽成效', duration: '20分鐘', type: '文件', icon: FileText },
  ];

  const documentation = [
    { title: 'API 開發文件', description: '整合MetaExpo到您的系統', icon: Code },
    { title: '功能完整手冊', description: '所有功能的詳細說明', icon: BookOpen },
    { title: '最佳實踐指南', description: '創建高品質展覽的技巧', icon: FileText },
    { title: '常見問題解答', description: '快速找到問題解答', icon: BookOpen },
  ];

  const downloads = [
    { title: '3D模型素材庫', description: '免費的3D展示物件與裝飾', size: '500+ 項目' },
    { title: '展廳模板合集', description: '精選專業展廳設計模板', size: '50+ 模板' },
    { title: '品牌設計資源', description: 'Logo、字體、配色方案', size: '100+ 資源' },
  ];

  const blogPosts = [
    { title: '2026元宇宙展覽趨勢報告', date: '2026年2月10日', category: '趨勢洞察', readTime: '8分鐘' },
    { title: '如何提升虛擬展覽的參與度', date: '2026年2月5日', category: '最佳實踐', readTime: '6分鐘' },
    { title: '成功案例：故宮虛擬博物館', date: '2026年1月28日', category: '客戶故事', readTime: '10分鐘' },
    { title: 'VR技術在藝術展覽的應用', date: '2026年1月20日', category: '技術分享', readTime: '12分鐘' },
  ];

  const filterItems = <T extends { title: string; description?: string }>(items: T[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white py-20">
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
              transition={{ delay: 0.2 }}
            >
              資源中心
            </motion.h1>
            <motion.p 
              className="text-xl mb-8 text-teal-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              教學指南、技術文件、設計素材，助您快速上手MetaExpo
            </motion.p>

            {/* Search */}
            <motion.div 
              className="max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 size-5 text-gray-400" />
                <Input
                  placeholder="搜尋教學、文件、資源..."
                  className="pl-12 py-6 text-lg bg-white text-gray-900"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="tutorials" className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-4 mb-12">
                <TabsTrigger value="tutorials">教學課程</TabsTrigger>
                <TabsTrigger value="documentation">技術文件</TabsTrigger>
                <TabsTrigger value="downloads">下載資源</TabsTrigger>
                <TabsTrigger value="blog">部落格</TabsTrigger>
              </TabsList>
            </motion.div>

            {/* Tutorials */}
            <TabsContent value="tutorials">
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h2 className="text-3xl text-gray-900 mb-4">影片教學與指南</h2>
                <p className="text-gray-600">從基礎到進階，系統化學習MetaExpo</p>
              </motion.div>
              <div className="grid md:grid-cols-2 gap-6">
                <AnimatePresence>
                  {filterItems(tutorials).map((tutorial, index) => (
                    <motion.div 
                      key={tutorial.title} 
                      className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-lg transition-all group cursor-pointer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -3 }}
                      onClick={() => toast.info(`開始學習：${tutorial.title}`, { description: `預計時長 ${tutorial.duration}` })}
                    >
                      <div className="flex items-start mb-4">
                        <motion.div 
                          className="bg-purple-100 p-3 rounded-lg mr-4"
                          whileHover={{ rotate: 10 }}
                        >
                          <tutorial.icon className="size-6 text-purple-600" />
                        </motion.div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                              {tutorial.type}
                            </span>
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="size-4 mr-1" />
                              {tutorial.duration}
                            </div>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                        {tutorial.title}
                      </h3>
                      <p className="text-gray-600 mb-4">{tutorial.description}</p>
                      <Button variant="outline" className="w-full group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-all">
                        開始學習
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filterItems(tutorials).length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    找不到符合「{searchQuery}」的教學內容
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Documentation */}
            <TabsContent value="documentation">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl text-gray-900 mb-4">技術文件</h2>
                <p className="text-gray-600">詳細的功能說明與開發者資源</p>
              </motion.div>
              <div className="grid md:grid-cols-2 gap-6">
                {filterItems(documentation).map((doc, index) => (
                  <motion.div 
                    key={doc.title} 
                    className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-blue-300 hover:shadow-lg transition-all group cursor-pointer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -3 }}
                    onClick={() => toast.info(`正在開啟：${doc.title}`, { description: '文件內容載入中' })}
                  >
                    <motion.div 
                      className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4"
                      whileHover={{ rotate: 10 }}
                    >
                      <doc.icon className="size-7 text-blue-600" />
                    </motion.div>
                    <h3 className="text-xl text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-gray-600 mb-4">{doc.description}</p>
                    <span className="text-blue-600 text-sm flex items-center">
                      閰讀文件 <ArrowRight className="size-4 ml-1" />
                    </span>
                  </motion.div>
                ))}
                {filterItems(documentation).length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    找不到符合「{searchQuery}」的文件
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Downloads */}
            <TabsContent value="downloads">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl text-gray-900 mb-4">下載資源</h2>
                <p className="text-gray-600">免費素材與模板，加速您的創作流程</p>
              </motion.div>
              <div className="grid md:grid-cols-3 gap-6">
                {filterItems(downloads).map((download, index) => (
                  <motion.div 
                    key={download.title} 
                    className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 hover:shadow-xl transition-shadow"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                  >
                    <motion.div 
                      className="bg-white w-14 h-14 rounded-lg flex items-center justify-center mb-4 shadow-sm"
                      whileHover={{ rotate: 10 }}
                    >
                      <Download className="size-7 text-purple-600" />
                    </motion.div>
                    <h3 className="text-xl text-gray-900 mb-2">{download.title}</h3>
                    <p className="text-gray-600 mb-4">{download.description}</p>
                    <div className="text-sm text-purple-600 mb-4">{download.size}</div>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => {
                          toast.success(`正在下載：${download.title}`, {
                            description: '下載將在幾秒後開始',
                            duration: 3000,
                          });
                        }}
                      >
                        <Download className="size-4 mr-2" />
                        下載
                      </Button>
                    </motion.div>
                  </motion.div>
                ))}
                {filterItems(downloads).length === 0 && (
                  <div className="col-span-3 text-center py-12 text-gray-500">
                    找不到符合「{searchQuery}」的下載資源
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Blog */}
            <TabsContent value="blog">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-3xl text-gray-900 mb-4">部落格文章</h2>
                <p className="text-gray-600">產業洞察、技術分享與成功故事</p>
              </motion.div>
              <div className="space-y-6">
                {filterItems(blogPosts.map((p) => ({ ...p, description: p.category }))).map((post, index) => (
                  <motion.div 
                    key={post.title} 
                    className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-lg transition-all group cursor-pointer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ x: 5 }}
                    onClick={() => toast.info(`開啟文章：${post.title}`, { description: `閱讀時間約 ${post.readTime}` })}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                            {post.category}
                          </span>
                          <span className="text-sm text-gray-500">{post.date}</span>
                          <div className="flex items-center text-sm text-gray-500">
                            <Clock className="size-4 mr-1" />
                            {post.readTime}
                          </div>
                        </div>
                        <h3 className="text-xl text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                          {post.title}
                        </h3>
                      </div>
                      <Button variant="ghost" className="text-purple-600 flex-shrink-0">
                        閰讀 <ArrowRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
                {filterItems(blogPosts.map((p) => ({ ...p, description: p.category }))).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    找不到符合「{searchQuery}」的文章
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* CTA */}
      <motion.div 
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            className="text-3xl mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            找不到您需要的資源？
          </motion.h2>
          <motion.p 
            className="text-purple-100 mb-8 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            聯繫我們的支援團隊，我們將竭誠為您服務
          </motion.p>
          <motion.div
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block"
          >
            <Link to="/support">
              <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg">
                聯繫支援團隊
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}