import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Calendar, MapPin, Users, Eye, Clock, TrendingUp, Bell, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

export default function Exhibitions() {
  const [visitingExhibition, setVisitingExhibition] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(new Set());

  const upcomingEvents = [
    { title: '2026台北數位藝術節', date: '2026年3月15日 - 3月30日', location: '線上虛擬展廳', visitors: '預計 5,000+ 人', image: 'https://images.unsplash.com/photo-1569342380852-035f42d9ca41?w=600&q=80', status: '即將開始', category: '藝術' },
    { title: '未來科技產品博覽會', date: '2026年4月1日 - 4月7日', location: '多廳展覽', visitors: '預計 10,000+ 人', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80', status: '開放報名', category: '科技' },
    { title: '古文明珍寶展', date: '2026年4月15日 - 5月15日', location: '虛擬博物館', visitors: '預計 8,000+ 人', image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&q=80', status: '籌備中', category: '文化' },
  ];

  const ongoingEvents = [
    { title: '當代攝影展：光影之間', date: '進行中 - 2月28日結束', location: '線上畫廊A廳', visitors: '已有 12,543 人參觀', image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80', status: '進行中', category: '攝影' },
    { title: '永續發展企業展', date: '進行中 - 3月10日結束', location: '企業展示廳', visitors: '已有 8,234 人參觀', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80', status: '進行中', category: '商業' },
  ];

  const stats = [
    { icon: Calendar, value: '40+', label: '年度展覽' },
    { icon: Eye, value: '120K+', label: '總參觀人次' },
    { icon: Users, value: '80+', label: '合作夥伴' },
    { icon: TrendingUp, value: '92%', label: '滿意度' },
  ];

  const handleVisit = (title: string) => {
    setVisitingExhibition(title);
  };

  const handleReminder = (title: string) => {
    const updated = new Set(reminders);
    if (updated.has(title)) {
      updated.delete(title);
      toast.info('已取消提醒', { description: `已取消「${title}」的開展提醒` });
    } else {
      updated.add(title);
      toast.success('已設定提醒', { description: `「${title}」開展時將通知您`, icon: <Bell className="size-4" /> });
    }
    setReminders(updated);
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
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
              展覽活動
            </motion.h1>
            <motion.p 
              className="text-xl mb-8 text-blue-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              探索精彩的虛擬展覽，參與全球文化藝術盛事
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.label} 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <div className="flex justify-center mb-3">
                  <motion.div 
                    className="bg-purple-100 p-3 rounded-lg"
                    whileHover={{ rotate: 10 }}
                  >
                    <stat.icon className="size-6 text-purple-600" />
                  </motion.div>
                </div>
                <div className="text-3xl text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Events Tabs */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="ongoing" className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                <TabsTrigger value="ongoing">進行中的展覽</TabsTrigger>
                <TabsTrigger value="upcoming">即將到來</TabsTrigger>
              </TabsList>
            </motion.div>

            <TabsContent value="ongoing">
              <div className="grid md:grid-cols-2 gap-8">
                {ongoingEvents.map((event, index) => (
                  <motion.div 
                    key={event.title} 
                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow group"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className="relative h-64 overflow-hidden">
                      <ImageWithFallback
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs flex items-center">
                          <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                          {event.status}
                        </span>
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-xs">
                          {event.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl text-gray-900 mb-3">{event.title}</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="size-4 mr-2 flex-shrink-0" />
                          {event.date}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="size-4 mr-2 flex-shrink-0" />
                          {event.location}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="size-4 mr-2 flex-shrink-0" />
                          {event.visitors}
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button 
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => handleVisit(event.title)}
                        >
                          <ExternalLink className="size-4 mr-2" />
                          立即參觀
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="upcoming">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingEvents.map((event, index) => (
                  <motion.div 
                    key={event.title} 
                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow group"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <ImageWithFallback
                        src={event.image}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                          {event.status}
                        </span>
                      </div>
                      <div className="absolute top-4 right-4">
                        <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-xs">
                          {event.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg text-gray-900 mb-3">{event.title}</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="size-4 mr-2 flex-shrink-0" />
                          {event.date}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="size-4 mr-2 flex-shrink-0" />
                          {event.location}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="size-4 mr-2 flex-shrink-0" />
                          {event.visitors}
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button 
                          variant={reminders.has(event.title) ? 'default' : 'outline'}
                          className={`w-full ${reminders.has(event.title) ? 'bg-purple-600 text-white' : ''}`}
                          onClick={() => handleReminder(event.title)}
                        >
                          <Bell className="size-4 mr-2" />
                          {reminders.has(event.title) ? '已設定提醒' : '設定提醒'}
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
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
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            className="text-3xl mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            想要舉辦您的虛擬展覽嗎？
          </motion.h2>
          <motion.p 
            className="text-blue-100 mb-8 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            無論是藝術展覽、產品發表還是企業展示，我們都能協助您
          </motion.p>
          <motion.div 
            className="flex justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link to="/register">
                <Button className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-6 text-lg">
                  立即開始籌辦
                </Button>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
              <Link to="/solutions">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                  查看解決方案
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Visit Dialog */}
      <Dialog open={!!visitingExhibition} onOpenChange={() => setVisitingExhibition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>進入展覽</DialogTitle>
            <DialogDescription>準備進入「{visitingExhibition}」</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-gray-700 mb-2">展覽環境載入中...</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  className="bg-purple-600 h-2 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2 }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 text-center">
              展覽將在新視窗中開啟，支援鍵盤和滑鼠操作
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVisitingExhibition(null)}>取消</Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { 
                toast.success('歡迎參觀！', { description: `正在進入「${visitingExhibition}」` });
                setVisitingExhibition(null);
              }}
            >
              進入展覽
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}