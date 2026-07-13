import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useI18n } from './I18nProvider';

export function Footer() {
  const { t } = useI18n();
  const footerLinks = {
    product: {
      titleKey: 'footerProduct',
      links: [
        { labelKey: 'footerProductGallery', path: '/virtual-gallery' },
        { labelKey: 'footerProductExhibitions', path: '/exhibitions' },
        { labelKey: 'footerProductVr', path: '/virtual-gallery' },
        { labelKey: 'footerProductAnalytics', path: '/solutions' },
        { labelKey: 'footerProductApi', path: '/resources' },
      ],
    },
    solutions: {
      titleKey: 'footerSolutions',
      links: [
        { labelKey: 'footerSolutionsArt', path: '/solutions' },
        { labelKey: 'footerSolutionsEnterprise', path: '/solutions' },
        { labelKey: 'footerSolutionsEducation', path: '/solutions' },
        { labelKey: 'footerSolutionsMuseum', path: '/solutions' },
        { labelKey: 'footerSolutionsEvents', path: '/solutions' },
      ],
    },
    resources: {
      titleKey: 'footerResources',
      links: [
        { labelKey: 'footerResourcesTutorials', path: '/resources' },
        { labelKey: 'footerResourcesCaseStudies', path: '/resources' },
        { labelKey: 'footerResourcesDocs', path: '/resources' },
        { labelKey: 'footerResourcesBlog', path: '/resources' },
        { labelKey: 'footerResourcesHelp', path: '/support' },
      ],
    },
    company: {
      titleKey: 'footerCompany',
      links: [
        { labelKey: 'footerCompanyAbout', path: '/support' },
        { labelKey: 'footerCompanyCareers', path: '/support' },
        { labelKey: 'footerCompanyNews', path: '/resources' },
        { labelKey: 'footerCompanyPartners', path: '/solutions' },
        { labelKey: 'footerCompanyContact', path: '/support' },
      ],
    },
  };

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
          </motion.div>

          {Object.values(footerLinks).map((section, sectionIndex) => (
            <motion.div
              key={section.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: sectionIndex * 0.1 }}
            >
              <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-foreground">{t(section.titleKey)}</h4>
              <ul className="space-y-2">
                {section.links.map((link, linkIndex) => (
                  <motion.li
                    key={link.labelKey}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: sectionIndex * 0.08 + linkIndex * 0.04 }}
                  >
                    <Link to={link.path} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {t(link.labelKey)}
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
            {[
              { labelKey: 'footerPrivacy', path: '/support' },
              { labelKey: 'footerTerms', path: '/support' },
              { labelKey: 'footerCookie', path: '/resources' },
            ].map((item) => (
              <motion.div
                key={item.labelKey}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                whileHover={{ y: -1 }}
              >
                <Link to={item.path}>{t(item.labelKey)}</Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
