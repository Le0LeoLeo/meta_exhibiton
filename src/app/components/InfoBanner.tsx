import { Button } from './ui/button';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';

export function InfoBanner() {
  const [isVisible, setIsVisible] = useState(true);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50, transition: { duration: 0.3 } }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            className="bg-blue-50 border border-blue-200 rounded-lg p-6 relative"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {/* Close button */}
            <motion.button 
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              onClick={() => setIsVisible(false)}
              whileHover={{ scale: 1.2, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="size-5" />
            </motion.button>

            {/* Content */}
            <div className="pr-8">
              <motion.div 
                className="flex items-start space-x-2 mb-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.span 
                  className="text-lg"
                  animate={{ 
                    rotate: [0, 10, -10, 10, 0],
                    scale: [1, 1.2, 1.2, 1.2, 1]
                  }}
                  transition={{ 
                    duration: 1,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                >
                  🎉
                </motion.span>
                <h3 className="text-gray-900">歡迎體驗：免費創建您的第一個虛擬展廳</h3>
              </motion.div>
              
              <motion.p 
                className="text-sm text-gray-700 leading-relaxed mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                現在註冊 MetaExpo，即可獲得30天專業版試用，體驗完整功能。
                包含3D展廳建立、多人同時瀏覽、數據分析報告等。
              </motion.p>

              <motion.div 
                className="flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Link to="/register">
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white text-sm">
                    立即體驗
                  </Button>
                </Link>
                <Link to="/solutions">
                  <Button variant="outline" className="text-sm">
                    了解更多詳情
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
