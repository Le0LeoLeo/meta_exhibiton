import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Palette, Building2, GraduationCap, Landmark, Store, Briefcase, Check, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

export default function Solutions() {
  const [contactOpen, setContactOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sending, setSending] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const solutions = [
    { icon: Palette, title: '藝術與文化', description: '為藝術家、畫廊和博物館提供專業的虛擬展覽工具', image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80', features: ['高解析度作品展示', '虛擬導覽功能', '藝術家介紹與作品說明', '線上藝術品交易整合', '觀眾互動與評論系統'], useCases: ['線上畫廊', '藝術博覽會', '個人作品展', '藝術教育'] },
    { icon: Building2, title: '企業展示', description: '協助企業打造專業的產品展示與品牌體驗空間', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80', features: ['3D產品展示', '互動式產品介紹', '即時客服與諮詢', '潛在客戶數據收集', '多語言支援'], useCases: ['產品發表會', '品牌展示廳', '虛擬展位', '企業展覽'] },
    { icon: GraduationCap, title: '教育培訓', description: '為教育機構提供創新的虛擬學習與展示環境', image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&q=80', features: ['虛擬教室與實驗室', '互動式學習材料', '學生作品展示', '遠距協作工具', '學習數據追蹤'], useCases: ['線上課程', '學生作品展', '虛擬校園', '教育展覽'] },
    { icon: Landmark, title: '文化遺產', description: '數位化保存與展示珍貴的歷史文物與遺址', image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&q=80', features: ['3D文物掃描展示', '歷史場景重建', '多媒體導覽', '教育資源整合', '文物保存記錄'], useCases: ['虛擬博物館', '文化遺址', '歷史展覽', '文物數位化'] },
    { icon: Store, title: '零售電商', description: '打造沉浸式的虛擬購物體驗', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80', features: ['虛擬店面設計', '3D產品預覽', '虛擬試衣/試用', '購物車整合', '個性化推薦'], useCases: ['虛擬商店', '品牌旗艦店', '產品展示', '時尚秀場'] },
    { icon: Briefcase, title: '展會活動', description: '為大型展會和活動提供虛擬化工具', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80', features: ['多展廳管理', '參展商管理系統', '網絡交流功能', '會議直播整合', '數據分析報告'], useCases: ['虛擬展會', '線上論壇', '行業博覽會', '招商活動'] },
  ];

  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.email) {
      toast.error('請填寫必填欄位', { description: '姓名和電子郵件為必填' });
      return;
    }
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    toast.success('諮詢請求已送出', { description: '我們的顧問團隊將在1個工作日內與您聯繫' });
    setContactOpen(false);
    setContactForm({ name: '', email: '', company: '', message: '' });
  };

  const handleDemoSubmit = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    toast.success('展示預約已確認', { description: '我們將透過電子郵件與您確認時間' });
    setDemoOpen(false);
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-20">
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
              產業解決方案
            </motion.h1>
            <motion.p 
              className="text-xl mb-8 text-indigo-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              針對不同產業特性，提供客製化的元宇宙展覽工具
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Solutions Grid */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-24">
            {solutions.map((solution, index) => (
              <motion.div 
                key={solution.title}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <motion.div 
                    className="flex items-center mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                  >
                    <motion.div 
                      className="bg-purple-100 p-3 rounded-lg mr-4"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      <solution.icon className="size-8 text-purple-600" />
                    </motion.div>
                    <h2 className="text-3xl text-gray-900">{solution.title}</h2>
                  </motion.div>
                  <motion.p 
                    className="text-gray-600 text-lg mb-6"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                  >
                    {solution.description}
                  </motion.p>
                  
                  <motion.div 
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                  >
                    <h3 className="text-lg text-gray-900 mb-3">核心功能</h3>
                    <ul className="space-y-2">
                      {solution.features.map((feature, i) => (
                        <motion.li 
                          key={feature} 
                          className="flex items-start"
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                        >
                          <Check className="size-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>

                  <motion.div 
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                  >
                    <h3 className="text-lg text-gray-900 mb-3">應用場景</h3>
                    <div className="flex flex-wrap gap-2">
                      {solution.useCases.map((useCase) => (
                        <motion.span 
                          key={useCase}
                          className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-purple-100 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toast.info(useCase, { description: `了解更多「${useCase}」的應用方式` })}
                        >
                          {useCase}
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button 
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => {
                        setExpandedIndex(expandedIndex === index ? null : index);
                        toast.info(`${solution.title}方案`, { description: '請聯繫我們取得詳細方案與報價' });
                      }}
                    >
                      了解更多
                    </Button>
                  </motion.div>
                </div>

                <motion.div 
                  className={index % 2 === 1 ? 'lg:order-1' : ''}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="rounded-2xl overflow-hidden shadow-2xl">
                    <ImageWithFallback
                      src={solution.image}
                      alt={solution.title}
                      className="w-full h-[400px] object-cover"
                    />
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <motion.div 
        className="bg-gray-50 py-16"
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
          >
            需要客製化解決方案？
          </motion.h2>
          <motion.p 
            className="text-gray-600 mb-8 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            我們的團隊將根據您的需求，協助規劃虛擬展覽方案
          </motion.p>
          <motion.div 
            className="flex justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Button 
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
                onClick={() => setContactOpen(true)}
              >
                聯繫專業顧問
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Button 
                variant="outline" 
                className="px-8 py-6 text-lg"
                onClick={() => setDemoOpen(true)}
              >
                預約線上展示
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>聯繫專業顧問</DialogTitle>
            <DialogDescription>填寫以下資訊，我們將盡快與您聯繫</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm text-gray-700 mb-1">姓名 *</label>
              <Input 
                placeholder="請輸入您的姓名" 
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">電子郵件 *</label>
              <Input 
                type="email" 
                placeholder="your@email.com"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">公司名稱</label>
              <Input 
                placeholder="您的公司或組織名稱"
                value={contactForm.company}
                onChange={(e) => setContactForm((p) => ({ ...p, company: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">需求描述</label>
              <Textarea 
                placeholder="簡述您的需求和期望..."
                rows={4}
                value={contactForm.message}
                onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setContactOpen(false)}>取消</Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleContactSubmit}
              disabled={sending}
            >
              {sending ? '送出中...' : <><Send className="size-4 mr-2" />送出諮詢</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Demo Dialog */}
      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>預約線上展示</DialogTitle>
            <DialogDescription>我們將安排線上會議，為您展示平台功能</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm text-gray-700 mb-1">聯絡姓名</label>
              <Input placeholder="請輸入您的姓名" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">電子郵件</label>
              <Input type="email" placeholder="your@email.com" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">偏好時段</label>
              <div className="grid grid-cols-2 gap-2">
                {['上午 10:00', '下午 14:00', '下午 16:00', '其他時間'].map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    className="text-sm"
                    onClick={() => toast.info(`已選擇 ${time}`)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDemoOpen(false)}>取消</Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleDemoSubmit}
              disabled={sending}
            >
              {sending ? '預約中...' : '確認預約'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}