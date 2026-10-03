import { BookOpen, Eye, ImagePlus, LayoutGrid, Share2 } from 'lucide-react';
import { Link } from 'react-router';
import { useI18n } from './I18nProvider';
import { buttonVariants } from './ui/button';
import { cn } from './ui/utils';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

const steps = [
  { icon: ImagePlus, title: 'visitorGuideUploadTitle', description: 'visitorGuideUploadDescription' },
  { icon: LayoutGrid, title: 'visitorGuideArrangeTitle', description: 'visitorGuideArrangeDescription' },
  { icon: Eye, title: 'visitorGuidePreviewTitle', description: 'visitorGuidePreviewDescription' },
  { icon: Share2, title: 'visitorGuideShareTitle', description: 'visitorGuideShareDescription' },
];

export function QuickStartTutorial() {
  const { t } = useI18n();

  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ variant: 'ghost' }), 'min-h-11 px-3 text-foreground')}>
        <BookOpen className="mr-2 size-4" aria-hidden="true" />
        {t('visitorGuideTitle')}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-6">
          <DialogTitle>{t('visitorGuideTitle')}</DialogTitle>
          <DialogDescription>{t('visitorGuideDescription')}</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-md border border-border bg-secondary p-4">
              <div className="mb-3 flex items-center gap-3 text-foreground">
                <span className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold"><span>{index + 1}. </span>{t(step.title)}</h3>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{t(step.description)}</p>
            </li>
          ))}
        </ol>
        <p className="rounded-md border border-border p-3 text-sm leading-6 text-muted-foreground">{t('visitorGuideDevices')}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <DialogClose asChild>
            <Link className={buttonVariants()} to="/virtual-gallery/quick-create">{t('quickExhibitionCreateAction')}</Link>
          </DialogClose>
          <DialogClose asChild>
            <Link className={buttonVariants({ variant: 'outline' })} to="/demo">{t('visitorDemoAction')}</Link>
          </DialogClose>
          <DialogClose className={buttonVariants({ variant: 'ghost' })}>
            {t('visitorGuideClose')}
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
