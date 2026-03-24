import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

export function Footer() {
  const footerLinks = {
    product: {
      title: '產品',
      links: [
        { label: '虛擬展廳', path: '/virtual-gallery' },
        { label: '展覽活動', path: '/exhibitions' },
        { label: 'VR體驗', path: '/virtual-gallery' },
        { label: '數據分析', path: '/solutions' },
        { label: '整合API', path: '/resources' },
      ],
    },
    solutions: {
      title: '解決方案',
      links: [
        { label: '藝術展覽', path: '/solutions' },
        { label: '企業展示', path: '/solutions' },
        { label: '教育培訓', path: '/solutions' },
        { label: '虛擬博物館', path: '/solutions' },
        { label: '活動策劃', path: '/solutions' },
      ],
    },
    resources: {
      title: '資源',
      links: [
        { label: '使用教學', path: '/resources' },
        { label: '案例研究', path: '/resources' },
        { label: '開發文件', path: '/resources' },
        { label: '部落格', path: '/resources' },
        { label: '幫助中心', path: '/support' },
      ],
    },
    company: {
      title: '公司',
      links: [
        { label: '關於我們', path: '/support' },
        { label: '職涯機會', path: '/support' },
        { label: '新聞中心', path: '/resources' },
        { label: '合作夥伴', path: '/solutions' },
        { label: '聯絡我們', path: '/support' },
      ],
    },
  };

  const socialIcons = [
    { Icon: Facebook, label: 'Facebook' },
    { Icon: Twitter, label: 'Twitter' },
    { Icon: Instagram, label: 'Instagram' },
    { Icon: Linkedin, label: 'LinkedIn' },
    { Icon: Youtube, label: 'YouTube' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          {/* Logo and Description */}
          <motion.div 
            className="md:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/">
              <span className="text-2xl text-cyan-400">MetaExpo</span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              打造下一代沉浸式虛擬展覽體驗
            </p>
            {/* Social Media */}
            <div className="flex space-x-4 mt-6">
              {socialIcons.map(({ Icon, label }, index) => (
                <motion.a 
                  key={label}
                  href="#" 
                  className="hover:text-white transition-colors"
                  aria-label={label}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, type: "spring" }}
                  whileHover={{ scale: 1.2, y: -3 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon className="size-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Links */}
          {Object.values(footerLinks).map((section, sectionIndex) => (
            <motion.div 
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
            >
              <h4 className="text-white mb-4">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <motion.li 
                    key={link.label}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: sectionIndex * 0.1 + linkIndex * 0.05 }}
                  >
                    <Link to={link.path}>
                      <motion.span 
                        className="text-sm hover:text-white transition-colors inline-block"
                        whileHover={{ x: 5 }}
                      >
                        {link.label}
                      </motion.span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom Bar */}
        <motion.div 
          className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-sm text-gray-400">
            © 2026 MetaExpo. 保留所有權利。
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {['隱私權政策', '服務條款', 'Cookie政策'].map((item) => (
              <motion.a 
                key={item}
                href="#" 
                className="text-sm hover:text-white transition-colors"
                whileHover={{ y: -2 }}
              >
                {item}
              </motion.a>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
