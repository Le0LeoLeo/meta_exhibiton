import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function Footer() {
  const { t } = useI18n();
  const footerLinks = {
    product: {
      title: t('footerProduct'),
      links: [
        { label: t('navVirtualGallery'), path: '/virtual-gallery' },
        { label: t('navExhibitions'), path: '/exhibitions' },
      ],
    },
    support: {
      title: t('footerSupport'),
      links: [
        { label: t('footerHelpCenter'), path: '/support' },
        { label: t('footerContactUs'), path: '/support' },
      ],
    },
    company: {
      title: t('footerCompany'),
      links: [
        { label: t('footerAboutUs'), path: '/support' },
        { label: t('footerPrivacy'), path: '#' },
        { label: t('footerTerms'), path: '#' },
      ],
    },
  };

  return (
    <footer className="border-t border-border bg-secondary text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 grid items-start gap-y-10 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-4"
        >
          <div>
            <Link to="/" className="text-base font-semibold tracking-tight text-foreground">
              <span className="block leading-tight">{t('appName')}</span>
              <span className="block text-xs font-medium text-muted-foreground">{t('appShort')}</span>
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('footerDescription')}</p>
          </div>

          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-foreground">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        <div className="border-t border-border pt-8 pb-3 text-center">
          <p className="text-xs text-muted-foreground">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
