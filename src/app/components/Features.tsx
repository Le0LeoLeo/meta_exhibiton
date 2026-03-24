import { Layers, Sparkles, Zap, Smile, Globe, Users, Headphones, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

export function Features() {
  const features = [
    {
      icon: Globe,
      title: '3D虛擬空間，突破地域限制',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      icon: Users,
      title: '即時互動，多人線上參觀',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      icon: Headphones,
      title: 'VR/AR沉浸式體驗',
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    },
    {
      icon: TrendingUp,
      title: '數據分析，精準了解觀眾行為',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
    },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div 
        className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        {features.map((feature, index) => (
          <motion.div 
            key={index} 
            className="flex items-start space-x-4"
            variants={item}
            whileHover={{ scale: 1.05, y: -5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className={`${feature.bgColor} p-3 rounded-lg flex-shrink-0`}
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <feature.icon className={`size-6 ${feature.color}`} />
            </motion.div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {feature.title}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Description Text */}
      <motion.div 
        className="mt-16 max-w-4xl"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <p className="text-gray-700 leading-relaxed">
          元宇宙展覽平台為企業、藝術機構和活動主辦方提供虛擬展示工具。透過3D虛擬空間，
          建立線上展覽，方便觀眾遠端參觀。平台整合了VR/AR瀏覽、即時互動、
          導覽系統和數據分析功能，協助您建立虛擬展廳並追蹤觀眾行為。
          適用於藝術展覽、產品發表會、博物館和企業展示等場景。
        </p>
      </motion.div>
    </div>
  );
}