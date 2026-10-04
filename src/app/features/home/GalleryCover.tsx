import { useState } from 'react';
import { useI18n } from '@/app/components/I18nProvider';

export function ExhibitionCover({ src, title, priority = false }: { src?: string; title: string; priority?: boolean }) {
  const { t } = useI18n();
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || src === failedSource) return <div className="home-cover-empty"><span>Paidea</span><p>{title}</p><small>{t('homeCoverMissing')}</small></div>;
  return <img src={src} alt={title} loading={priority ? 'eager' : 'lazy'} onError={() => setFailedSource(src)} />;
}
