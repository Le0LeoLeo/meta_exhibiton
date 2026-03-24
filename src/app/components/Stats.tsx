import { motion, useInView } from 'motion/react';
import { useRef, useEffect, useState } from 'react';

function AnimatedCounter({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (!isInView) return;

    const numericValue = parseInt(value.replace(/[^0-9]/g, ''));
    const suffix = value.replace(/[0-9]/g, '');
    
    if (isNaN(numericValue)) {
      setDisplayValue(value);
      return;
    }

    let current = 0;
    const increment = numericValue / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current) + suffix);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return <div ref={ref}>{displayValue}</div>;
}

export function Stats() {
  const stats = [
    { value: '800+', label: '註冊用戶' },
    { value: '350+', label: '虛擬展覽' },
    { value: '120K+', label: '展覽訪客' },
    { value: '92%', label: '客戶滿意度' },
  ];

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 py-16 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div 
              key={index} 
              className="text-center"
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 100
              }}
              whileHover={{ scale: 1.1, y: -10 }}
            >
              <motion.div 
                className="text-4xl md:text-5xl text-white mb-2"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
              >
                <AnimatedCounter value={stat.value} />
              </motion.div>
              <motion.div 
                className="text-purple-100"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 + 0.4 }}
              >
                {stat.label}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}