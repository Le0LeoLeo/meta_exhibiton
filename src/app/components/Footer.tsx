import { Link } from 'react-router';
import { useI18n } from './I18nProvider';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  const { t } = useI18n();
  return <footer className="home-footer">
    <div><Link to="/" aria-label="Paidea" className="inline-flex items-center"><BrandLogo /></Link><p>{t('homeFooter')}</p></div>
    <nav aria-label={t('footerResources')}>
      <Link to="/demo">{t('homeTryDemo')}</Link>
      <Link to="/exhibitions">{t('homeFindExhibitions')}</Link>
      <Link to="/support">{t('navSupport')}</Link><Link to="/resources">{t('navResources')}</Link>
      <Link to="/privacy">{t('footerPrivacy')}</Link><Link to="/terms">{t('footerTerms')}</Link>
    </nav><small>{t('copyright')}</small>
  </footer>;
}
