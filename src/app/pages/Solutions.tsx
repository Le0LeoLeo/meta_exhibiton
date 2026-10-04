import { Link } from 'react-router';
import {
  ArrowRight,
  BotMessageSquare,
  GraduationCap,
  UsersRound,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useI18n } from '../components/I18nProvider';

const learningScenarios = [
  {
    key: 'student-projects',
    titleKey: 'aiEducationStudentTitle',
    audienceKey: 'aiEducationStudentAudience',
    descKey: 'aiEducationStudentDesc',
    actionKey: 'aiEducationStudentAction',
    href: '/graduation#student',
    icon: GraduationCap,
  },
  {
    key: 'teacher-review',
    titleKey: 'aiEducationTeacherTitle',
    audienceKey: 'aiEducationTeacherAudience',
    descKey: 'aiEducationTeacherDesc',
    actionKey: 'aiEducationTeacherAction',
    href: '/graduation#teacher',
    icon: UsersRound,
  },
  {
    key: 'agent-inquiry',
    titleKey: 'aiEducationAgentTitle',
    audienceKey: 'aiEducationAgentAudience',
    descKey: 'aiEducationAgentDesc',
    actionKey: 'aiEducationAgentAction',
    href: '/demo',
    icon: BotMessageSquare,
  },
];

export default function Solutions() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border">
        <div className="museum-page-heading">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('aiEducationLabel')}</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">{t('aiEducationHeroTitle')}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t('aiEducationHeroDesc')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/graduation">{t('aiEducationPrimary')}<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
            <Button variant="outline" asChild><Link to="/demo">{t('aiEducationDemo')}</Link></Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="learning-scenarios-title" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 id="learning-scenarios-title" className="mb-6 text-2xl font-semibold">{t('aiEducationScenarios')}</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {learningScenarios.map(({ key, titleKey, audienceKey, descKey, actionKey, href, icon: Icon }) => (
            <article key={key} id={`scenario-${key}`} className="flex flex-col rounded-md border border-border bg-card p-6">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass">
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-semibold">{t(titleKey)}</h3>
              <p className="mt-3 text-sm font-medium leading-6 text-foreground">{t(audienceKey)}</p>
              <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{t(descKey)}</p>
              <Link to={href} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">
                {t(actionKey)}<ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {key === 'student-projects' && <Link to="/graduation/portfolio" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">{t('aiEducationPortfolioAction')}</Link>}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="learning-cycle-title" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 id="learning-cycle-title" className="text-3xl font-semibold">{t('aiEducationCycleTitle')}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('aiEducationCycleIntro')}</p>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((step) => <li key={step} className="border-t border-border pt-5">
            <span className="text-sm font-semibold text-curator-brass" aria-hidden="true">0{step}</span>
            <h3 className="mt-3 text-lg font-semibold">{t(`aiEducationStep${step}Title`)}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(`aiEducationStep${step}Desc`)}</p>
          </li>)}
        </ol>
        <div className="mt-8 rounded-md border border-border bg-secondary/40 p-5">
          <h3 className="font-semibold">{t('aiEducationGuidanceTitle')}</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{t('aiEducationGuidanceDesc')}</p>
        </div>
      </section>

      <section aria-labelledby="education-tools-title" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <p className="text-xs font-semibold tracking-wide text-curator-brass">{t('ssWorkflowLabel')}</p>
        <h2 id="education-tools-title" className="mt-3 text-3xl font-semibold">{t('solutionsEducationTools')}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            'solutionsToolExhibitions',
            'solutionsToolMultiplayer',
            'solutionsToolAgent',
          ].map((key, index) => (
            <div key={key} className="border-t border-border pt-6">
              <span className="text-sm font-semibold text-curator-brass">0{index + 1}</span>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{t(key)}</p>
            </div>
          ))}
        </div>
        <Link to="/support" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">{t('ssHelp')}<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </section>

      <section className="border-t border-border bg-secondary px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-curator-brass">{t('solutionsNextStepLabel')}</p>
          <h2 className="text-3xl font-semibold text-foreground">{t('aiEducationNextStepTitle')}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t('aiEducationNextStepDesc')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild><Link to="/graduation">{t('aiEducationPrimary')}<ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
            <Button variant="outline" asChild><Link to="/demo">{t('aiEducationDemo')}</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
