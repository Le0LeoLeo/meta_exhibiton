import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function Testimonials() {
  const { t } = useI18n();
  const testimonials = [
    {
      name: t('testimonials.item1.name'),
      role: t('testimonials.item1.role'),
      content: t('testimonials.item1.content'),
      rating: 5,
    },
    {
      name: t('testimonials.item2.name'),
      role: t('testimonials.item2.role'),
      content: t('testimonials.item2.content'),
      rating: 5,
    },
    {
      name: t('testimonials.item3.name'),
      role: t('testimonials.item3.role'),
      content: t('testimonials.item3.content'),
      rating: 5,
    },
  ];

  return (
    <div className="bg-purple-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl text-gray-900 mb-4">{t('testimonials.sectionTitle')}</h2>
          <p className="text-xl text-gray-600">{t('testimonials.sectionSubtitle')}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div 
              key={index} 
              className="bg-white rounded-xl p-8 shadow-lg"
              initial={{ opacity: 0, y: 50, rotateY: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              whileHover={{ 
                y: -10, 
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                transition: { duration: 0.3 }
              }}
            >
              <motion.div 
                className="flex mb-4"
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 + 0.3, type: "spring", stiffness: 200 }}
              >
                {[...Array(testimonial.rating)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, rotate: -180 }}
                    whileInView={{ opacity: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 + 0.4 + i * 0.1 }}
                  >
                    <Star className="size-5 fill-yellow-400 text-yellow-400" />
                  </motion.div>
                ))}
              </motion.div>
              <motion.p 
                className="text-gray-700 mb-6 leading-relaxed"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 + 0.5 }}
              >
                "{testimonial.content}"
              </motion.p>
              <motion.div 
                className="border-t pt-4"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 + 0.6 }}
              >
                <p className="text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-600">{testimonial.role}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
