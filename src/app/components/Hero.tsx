import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Play, X } from 'lucide-react';

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="inline-flex items-center space-x-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
              </span>
              <span>元宇宙虛擬展覽平台</span>
            </motion.div>

            <motion.h1 
              className="text-5xl lg:text-6xl text-gray-900"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              開創虛擬展覽
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                新體驗
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              MetaExpo 提供3D虛擬展覽空間，讓參觀者不受地點限制，
              線上瀏覽您的展覽。適用於藝術畫廊、產品發表會、
              企業展示及教育培訓等多種場景。
            </motion.p>

            {/* Features List */}
            <motion.div
              className="grid grid-cols-2 gap-4 py-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              {[
                { icon: '🌐', text: '全球觸及' },
                { icon: '🎨', text: '自由設計' },
                { icon: '📊', text: '數據分析' },
                { icon: '💰', text: '降低成本' },
              ].map((item, index) => (
                <motion.div
                  key={item.text}
                  className="flex items-center space-x-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-gray-700">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div 
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              <Link to="/register">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg w-full">
                    立即體驗
                  </Button>
                </motion.div>
              </Link>
              <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="outline" 
                  className="px-8 py-6 text-lg w-full"
                  onClick={() => setVideoOpen(true)}
                >
                  <Play className="size-5 mr-2" />
                  觀看演示影片
                </Button>
              </motion.div>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              className="flex items-center space-x-6 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.1 + i * 0.1 }}
                      className="text-yellow-400"
                    >
                      ⭐
                    </motion.span>
                  ))}
                </div>
                <p className="text-xs">用戶好評推薦</p>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="text-sm text-gray-600">
                <p className="font-semibold text-gray-900">快速上手</p>
                <p className="text-xs">註冊即可使用</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - VR Image */}
          <motion.div 
            initial={{ opacity: 0, x: 50, rotate: 5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=800&q=80"
                alt="元宇宙虛擬展覽體驗" 
                className="w-full h-auto rounded-lg shadow-2xl"
              />
            </motion.div>
            
            {/* Floating Stats Cards */}
            <motion.div
              className="absolute top-8 -left-4 bg-white rounded-lg shadow-xl p-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-sm text-gray-600 mb-1">進行中展覽</div>
              <div className="text-2xl text-purple-600">120+</div>
            </motion.div>

            <motion.div
              className="absolute bottom-8 -right-4 bg-white rounded-lg shadow-xl p-4"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            >
              <div className="text-sm text-gray-600 mb-1">本月訪客</div>
              <div className="text-2xl text-blue-600">8,500+</div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Video Dialog */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>MetaExpo 平台演示</DialogTitle>
            <DialogDescription>了解如何使用 MetaExpo 建立虛擬展覽</DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Play className="size-16 mx-auto mb-4 text-purple-400" />
              <p className="text-lg">演示影片</p>
              <p className="text-sm mt-2">影片內容載入中...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
