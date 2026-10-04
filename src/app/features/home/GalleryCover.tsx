import { useState } from 'react';
import { useI18n } from '@/app/components/I18nProvider';

export function ExhibitionCover({ src, srcSet, title, priority = false }: { src?: string; srcSet?: string; title: string; priority?: boolean }) {
  const { t } = useI18n();
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || src === failedSource) return <div className="home-cover-empty"><span>Paidea</span><p>{title}</p><small>{t('homeCoverMissing')}</small></div>;
  return <img src={src} srcSet={srcSet} alt={title} loading={priority ? 'eager' : 'lazy'} onError={() => setFailedSource(src)} />;
}
