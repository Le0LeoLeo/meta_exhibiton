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
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
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
    <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="mx-auto max-w-3xl pb-12 pt-8 text-center">
          <motion.p
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Support
          </motion.p>
          <motion.h1
            className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            幫助與支援
          </motion.h1>
          <motion.p
            className="mb-8 text-lg text-muted-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            我們隨時準備協助您，讓您的虛擬展覽體驗更加順暢
          </motion.p>
          <motion.div
            className="mx-auto max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜尋常見問題..."
                className="bg-card py-6 pl-12 text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </motion.div>
        </section>

        <section className="py-10">
          <p className="mb-8 text-center text-xs font-semibold uppercase tracking-wide text-curator-brass">Quick Guide</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link, index) => {
              const content = (
                <motion.div
                  className="group flex h-full flex-col items-center rounded-md border border-border bg-card p-6 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ y: -3 }}
                >
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass transition-colors group-hover:text-foreground">
                    <link.icon className="size-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">{link.title}</div>
                </motion.div>
              );

              return link.path.startsWith('/') ? (
                <Link key={link.title} to={link.path}>{content}</Link>
              ) : (
                <a
                  key={link.title}
                  href={link.path}
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
                  {content}
                </a>
              );
            })}
          </div>
        </section>

        <section className="py-14">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">Contact</p>
            <h2 className="text-3xl font-semibold text-foreground">聯繫我們</h2>
            <p className="mt-3 text-sm text-muted-foreground">選擇最適合您的聯繫方式</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {contactMethods.map((method, index) => (
              <motion.div
                key={method.title}
                className="rounded-md border border-border bg-card p-6 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -3 }}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
                  <method.icon className="size-7" />
                </div>
                <h3 className="mb-2 text-xl font-medium text-foreground">{method.title}</h3>
                <p className="mb-2 text-muted-foreground">{method.description}</p>
                <p className="mb-4 text-sm text-muted-foreground">{method.availability}</p>
                <Button className="w-full" onClick={() => handleContactAction(method)}>
                  {method.action}
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="border-t border-border py-14" id="faq-section">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">FAQ</p>
              <h2 className="text-3xl font-semibold text-foreground">常見問題</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {searchQuery ? `搜尋「${searchQuery}」的結果（${filteredFaqs.length} 筆）` : '快速找到常見問題的解答'}
              </p>
            </div>
            {filteredFaqs.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <AccordionItem
                      value={`item-${index}`}
                      className="rounded-md border border-border bg-card px-5 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
                    >
                      <AccordionTrigger className="text-left text-foreground hover:text-curator-brass">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            ) : (
              <motion.div
                className="rounded-md border border-border bg-card p-8 text-center shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <HelpCircle className="mx-auto mb-4 size-12 text-curator-brass" />
                <p className="mb-4 text-muted-foreground">找不到符合「{searchQuery}」的問題</p>
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  清除搜尋
                </Button>
              </motion.div>
            )}
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">Request</p>
              <h2 className="text-3xl font-semibold text-foreground">提交支援請求</h2>
              <p className="mt-3 text-sm text-muted-foreground">填寫表單，我們將盡快回覆您</p>
            </div>
            <motion.form
              className="space-y-6 rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
              onSubmit={handleFormSubmit}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="support-name" className="mb-2 block text-sm text-muted-foreground">姓名 *</label>
                  <Input
                    id="support-name"
                    placeholder="請輸入您的姓名"
                    className={formErrors.name ? 'border-destructive' : ''}
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                  />
                  {formErrors.name && <p className="mt-1 text-xs text-destructive">{formErrors.name}</p>}
                </div>
                <div>
                  <label htmlFor="support-email" className="mb-2 block text-sm text-muted-foreground">電子郵件 *</label>
                  <Input
                    id="support-email"
                    type="email"
                    placeholder="your@email.com"
                    className={formErrors.email ? 'border-destructive' : ''}
                    value={formData.email}
                    onChange={(e) => updateFormField('email', e.target.value)}
                  />
                  {formErrors.email && <p className="mt-1 text-xs text-destructive">{formErrors.email}</p>}
                </div>
              </div>
              <div>
                <label htmlFor="support-subject" className="mb-2 block text-sm text-muted-foreground">主旨 *</label>
                <Input
                  id="support-subject"
                  placeholder="請簡述您的問題"
                  className={formErrors.subject ? 'border-destructive' : ''}
                  value={formData.subject}
                  onChange={(e) => updateFormField('subject', e.target.value)}
                />
                {formErrors.subject && <p className="mt-1 text-xs text-destructive">{formErrors.subject}</p>}
              </div>
              <div>
                <label htmlFor="support-description" className="mb-2 block text-sm text-muted-foreground">問題描述 *</label>
                <Textarea
                  id="support-description"
                  placeholder="請詳細描述您遇到的問題或需求..."
                  rows={6}
                  className={formErrors.description ? 'border-destructive' : ''}
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                />
                {formErrors.description && <p className="mt-1 text-xs text-destructive">{formErrors.description}</p>}
              </div>
              <Button type="submit" className="w-full py-6 text-lg" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    提交中...
                  </span>
                ) : '提交請求'}
              </Button>
            </motion.form>
          </div>
        </section>
      </div>
    </div>
  );
}
