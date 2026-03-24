import { ImageWithFallback } from './figma/ImageWithFallback';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

export function Showcase() {
  const showcases = [
    {
      title: '藝術展覽',
      description: '為藝術作品打造沉浸式虛擬畫廊',
      image: 'https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&q=80',
      tag: '藝術',
    },
    {
      title: '產品發表會',
      description: '創新的產品展示與互動體驗',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80',
      tag: '商業',
    },
    {
      title: '虛擬博物館',
      description: '讓歷史文物走向全球觀眾',
      image: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=600&q=80',
      tag: '文化',
    },
  ];

  return (
    <div className="bg-gray-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl text-gray-900 mb-4">應用場景</h2>
          <p className="text-xl text-gray-600">不同場景下的虛擬展覽應用</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {showcases.map((showcase, index) => (
            <Link to="/solutions" key={showcase.title}>
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                whileHover={{ y: -10 }}
                className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow group cursor-pointer"
              >
                <div className="relative h-64 overflow-hidden">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <ImageWithFallback
                      src={showcase.image}
                      alt={showcase.title}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                  <motion.div 
                    className="absolute top-4 left-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 + 0.3 }}
                  >
                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                      {showcase.tag}
                    </span>
                  </motion.div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl text-gray-900 mb-2">{showcase.title}</h3>
                  <p className="text-gray-600 mb-4">{showcase.description}</p>
                  <motion.div 
                    className="flex items-center text-purple-600 group-hover:text-purple-700"
                    whileHover={{ x: 5 }}
                  >
                    <span className="text-sm">查看詳情</span>
                    <ArrowRight className="size-4 ml-2" />
                  </motion.div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
