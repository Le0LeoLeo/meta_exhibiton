import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { MessageCircle, Mail, Phone, Search, HelpCircle, Book, Video, Users } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

export default function Support() {
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const contactMethods = [
    { icon: MessageCircle, title: '即時客服', description: '線上聊天，即時解答', availability: '週一至週五 9:00-18:00', action: '開始對話' },
    { icon: Mail, title: '電子郵件', description: 'support@metaexpo.com', availability: '24小時內回覆', action: '發送郵件' },
    { icon: Phone, title: '電話支援', description: '+886-2-1234-5678', availability: '週一至週五 9:00-18:00', action: '立即撥打' },
  ];

  const faqs = [
    { question: '如何開始創建我的第一個虛擬展廳？', answer: '註冊帳號後，點擊「創建展廳」按鈕，選擇一個模板或從空白畫布開始。我們的直覺式編輯器讓您可以輕鬆拖放元素、上傳展品並自訂空間設計。建議先觀看我們的快速入門影片教學（約10分鐘），您就能掌握基本操作。' },
    { question: '可以整合到我現有的網站嗎？', answer: '是的！我們提供完整的API和嵌入式程式碼，讓您可以將虛擬展廳無縫整合到您的網站中。支援iframe嵌入或API整合，並支援客製化網域設定。詳細的技術文件可在資源中心找到。' },
    { question: '支援哪些3D檔案格式？', answer: '我們支援常見的3D格式包括：GLB、GLTF、FBX、OBJ等。同時也支援一般圖片格式（JPG、PNG）、影片（MP4、WebM）和音訊檔案（MP3、WAV）。建議上傳前先優化檔案大小以確保最佳載入速度。' },
    { question: '可以追蹤訪客數據嗎？', answer: '平台提供數據分析功能，包括：訪客人數、停留時間、參觀路徑、熱點分析、互動率等。這些數據以視覺化圖表呈現，並可匯出為報告。您還可以設定Google Analytics整合以進行更深入的分析。' },
    { question: 'VR模式需要什麼設備？', answer: 'VR模式支援主流VR頭戴裝置如Meta Quest、HTC Vive、Valve Index等。訪客也可以使用手機配合簡易VR眼鏡（如Google Cardboard）體驗。若沒有VR設備，也能透過一般電腦或手機瀏覽器以3D模式參觀。' },
    { question: '如何邀請團隊成員協作？', answer: '在展廳設定中點擊「團隊協作」，輸入成員的電子郵件地址即可發送邀請。您可以設定不同的權限等級（管理員、編輯者、檢視者）。團隊成員可以同時編輯展廳，所有變更會即時同步。' },
    { question: '資料安全性如何保障？', answer: '我們採用業界標準的安全措施，包括SSL加密傳輸、定期資料備份、多重身份驗證選項。所有資料儲存在符合ISO 27001認證的資料中心。' },
  ];

  const filteredFaqs = searchQuery.trim()
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  const quickLinks = [
    { icon: Book, title: '使用手冊', path: '/resources' },
    { icon: Video, title: '影片教學', path: '/resources' },
    { icon: HelpCircle, title: '常見問題', path: '#faq' },
    { icon: Users, title: '社群論壇', path: '#' },
  ];

  const handleContactAction = (method: typeof contactMethods[0]) => {
    if (method.title === '即時客服') {
      toast.success('客服已上線', { description: '正在為您連接客服人員...' });
    } else if (method.title === '電子郵件') {
      toast.info('即將開啟郵件', { description: '請透過 support@metaexpo.com 聯繫我們' });
    } else {
      toast.info('電話支援', { description: '請撥打 +886-2-1234-5678' });
    }
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = '請輸入姓名';
    if (!formData.email.trim()) errs.email = '請輸入電子郵件';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = '請輸入有效的電子郵件';
    if (!formData.subject.trim()) errs.subject = '請輸入主旨';
    if (!formData.description.trim()) errs.description = '請描述您的問題';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSubmitting(false);
    toast.success('支援請求已提交', { description: '我們將在24小時內回覆您' });
    setFormData({ name: '', email: '', subject: '', description: '' });
    setFormErrors({});
  };

  const updateFormField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white py-20">
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
              幫助與支援
            </motion.h1>
            <motion.p 
              className="text-xl mb-8 text-green-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              我們隨時準備協助您，讓您的虛擬展覽體驗更加順暢
            </motion.p>
            {/* Search Bar */}
            <motion.div 
              className="max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 size-5 text-gray-400" />
                <Input
                  placeholder="搜尋常見問題..."
                  className="pl-12 py-6 text-lg bg-white text-gray-900"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-6">
            {quickLinks.map((link, index) => (
              <motion.div
                key={link.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
              >
                {link.path.startsWith('/') ? (
                  <Link
                    to={link.path}
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow text-center group block"
                  >
                    <motion.div 
                      className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors"
                      whileHover={{ rotate: 10 }}
                    >
                      <link.icon className="size-6 text-green-600" />
                    </motion.div>
                    <div className="text-gray-900 group-hover:text-green-600 transition-colors">
                      {link.title}
                    </div>
                  </Link>
                ) : (
                  <a
                    href={link.path}
                    className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow text-center group block"
                    onClick={(e) => {
                      if (link.path === '#faq') {
                        e.preventDefault();
                        document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
                      } else if (link.path === '#') {
                        e.preventDefault();
                        toast.info('社群論壇', { description: '社群論壇功能即將上線' });
                      }
                    }}
                  >
                    <motion.div 
                      className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors"
                      whileHover={{ rotate: 10 }}
                    >
                      <link.icon className="size-6 text-green-600" />
                    </motion.div>
                    <div className="text-gray-900 group-hover:text-green-600 transition-colors">
                      {link.title}
                    </div>
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl text-gray-900 mb-4">聯繫我們</h2>
            <p className="text-gray-600">選擇最適合您的聯繫方式</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {contactMethods.map((method, index) => (
              <motion.div 
                key={method.title} 
                className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:border-green-300 hover:shadow-lg transition-all text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -5 }}
              >
                <motion.div 
                  className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  whileHover={{ scale: 1.1, rotate: 10 }}
                >
                  <method.icon className="size-8 text-green-600" />
                </motion.div>
                <h3 className="text-xl text-gray-900 mb-2">{method.title}</h3>
                <p className="text-gray-600 mb-2">{method.description}</p>
                <p className="text-sm text-gray-500 mb-4">{method.availability}</p>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                    onClick={() => handleContactAction(method)}
                  >
                    {method.action}
                  </Button>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 bg-gray-50" id="faq-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl text-gray-900 mb-4">常見問題</h2>
            <p className="text-gray-600">
              {searchQuery ? `搜尋「${searchQuery}」的結果（${filteredFaqs.length} 筆）` : '快速找到常見問題的解答'}
            </p>
          </motion.div>
          {filteredFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <motion.div
                  key={faq.question}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                >
                  <AccordionItem 
                    value={`item-${index}`}
                    className="bg-white border-2 border-gray-200 rounded-xl px-6 hover:border-green-300 transition-colors"
                  >
                    <AccordionTrigger className="text-left text-gray-900 hover:text-green-600">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600 leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          ) : (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <HelpCircle className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">找不到符合「{searchQuery}」的問題</p>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
              >
                清除搜尋
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Contact Form */}
      <div className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl text-gray-900 mb-4">提交支援請求</h2>
            <p className="text-gray-600">填寫表單，我們將盡快回覆您</p>
          </motion.div>
          <motion.form 
            className="space-y-6 bg-white p-8 rounded-2xl shadow-lg"
            onSubmit={handleFormSubmit}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">姓名 *</label>
                <Input 
                  placeholder="請輸入您的姓名"
                  className={formErrors.name ? 'border-red-500' : ''}
                  value={formData.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-2">電子郵件 *</label>
                <Input 
                  type="email" 
                  placeholder="your@email.com"
                  className={formErrors.email ? 'border-red-500' : ''}
                  value={formData.email}
                  onChange={(e) => updateFormField('email', e.target.value)}
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">主旨 *</label>
              <Input 
                placeholder="請簡述您的問題"
                className={formErrors.subject ? 'border-red-500' : ''}
                value={formData.subject}
                onChange={(e) => updateFormField('subject', e.target.value)}
              />
              {formErrors.subject && <p className="text-red-500 text-xs mt-1">{formErrors.subject}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">問題描述 *</label>
              <Textarea 
                placeholder="請詳細描述您遇到的問題或需求..." 
                rows={6}
                className={formErrors.description ? 'border-red-500' : ''}
                value={formData.description}
                onChange={(e) => updateFormField('description', e.target.value)}
              />
              {formErrors.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    提交中...
                  </span>
                ) : '提交請求'}
              </Button>
            </motion.div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}