import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import { useI18n } from './I18nProvider';

export function Footer() {
  const { t } = useI18n();
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
    <footer className="border-t border-border bg-secondary text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-12 grid items-start gap-y-10 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/" className="text-base font-semibold tracking-tight text-foreground">
              <span className="block leading-tight">{t('appName')}</span>
              <span className="block text-xs font-medium text-muted-foreground">{t('appShort')}</span>
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('footerDescription')}</p>
            <div className="mt-6 flex gap-4">
              {socialIcons.map(({ Icon, label }, index) => (
                <motion.a
                  key={label}
                  href="#"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08, type: 'spring' }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="size-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {Object.values(footerLinks).map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
            >
              <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-foreground">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <motion.li
                    key={link.label}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: sectionIndex * 0.08 + linkIndex * 0.04 }}
                  >
                    <Link to={link.path} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 pb-3 text-center md:flex-row md:text-left"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-xs text-muted-foreground">{t('copyright')}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {['隱私權政策', '服務條款', 'Cookie政策'].map((item) => (
              <motion.a
                key={item}
                href="#"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                whileHover={{ y: -1 }}
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
