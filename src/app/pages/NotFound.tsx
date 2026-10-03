import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  return <div className="flex min-h-[65vh] items-center bg-background px-6 py-20">
    <div className="mx-auto w-full max-w-3xl border-t border-border pt-10">
      <p className="mb-6 text-sm tracking-widest text-muted-foreground">META EXB / 404</p>
      <h1 className="mb-5 text-4xl text-foreground">{t('notFoundHeading')}</h1>
      <p className="mb-8 leading-7 text-muted-foreground">{t('notFoundDesc')}</p>
      <Button asChild className="min-h-11"><Link to="/"><ArrowLeft className="size-4" />{t('notFoundHome')}</Link></Button>
    </div>
  </div>;
}
