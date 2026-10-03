import { Link } from 'react-router';
import { useI18n } from './I18nProvider';

export function Footer() {
  const { t } = useI18n();
  return <footer className="home-footer">
    <div><Link to="/" className="home-brand inline-flex items-center gap-2"><img src="/brand/metaexb-icon-v1.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-lg bg-[#a82e23] object-contain" />META EXB</Link><p>{t('homeFooter')}</p></div>
    <nav aria-label={t('footerResources')}>
      <Link to="/demo">{t('homeTryDemo')}</Link>
      <Link to="/exhibitions">{t('homeFindExhibitions')}</Link>
      <Link to="/support">{t('navSupport')}</Link><Link to="/resources">{t('navResources')}</Link>
      <Link to="/privacy">{t('footerPrivacy')}</Link><Link to="/terms">{t('footerTerms')}</Link>
    </nav><small>{t('copyright')}</small>
  </footer>;
}
