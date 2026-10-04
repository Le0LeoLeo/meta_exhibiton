import { JourneyConsent } from '@/app/features/journey-analytics/JourneyConsent';
import { recordJourney, useJourneyStep } from '@/app/features/journey-analytics/journey';
import { demoExhibitions } from '@/app/features/public-demo/demoCatalog';
import { useRef } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/app/components/I18nProvider';
import { QuickStartTutorial } from '@/app/components/QuickStartTutorial';


import { ExhibitionCover } from '@/app/features/home/GalleryCover';
import { useExhibitionReveals } from '@/app/features/home/useExhibitionReveals';
import '@/styles/home-motion.css';
import { GalleryAtmosphere } from '@/app/features/home/GalleryAtmosphere';
import '@/styles/home-product.css';

export default function Home() {
  useJourneyStep('home');
  const { t, locale } = useI18n();
  const revealRoot = useRef<HTMLDivElement>(null);
  useExhibitionReveals(revealRoot, 'official');
  const featuredHref = '/demo';
  const featuredTitle = t('demoClassTitle');

  return <div ref={revealRoot} className="museum-home">
    <section className="home-hero home-poster home-showcase" aria-labelledby="home-title">
      <GalleryAtmosphere />
      <div className="home-intro">
        <p className="home-eyebrow">{t('homeAIFeatureLabel')}</p>
        <h1 id="home-title"><span className="home-title-mask"><span>{t('homeAIHeroStart')}</span></span><br/><span className="home-title-mask"><span>{t('homeAIHeroEnd')}</span></span></h1>
        <p className="home-intro-copy home-product-intro">{t('homeAIIntro')}</p>
        <div className="home-actions home-hero-actions">
          <Link className="home-button home-button-dark" to="/solutions">
            <span>{t('homeAIPrimary')}</span><span className="home-button-icon" aria-hidden="true"><ArrowRight size={18}/></span>
          </Link>
          <Link className="home-button home-button-outline" to="/graduation">
            <span>{t('homeAIWorkspace')}</span><span className="home-button-icon" aria-hidden="true"><ArrowRight size={18}/></span>
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
          <Link className="inline-flex min-h-11 items-center gap-2 text-foreground underline underline-offset-4" to="/virtual-gallery/quick-create" onClick={() => recordJourney('create_start')}>{t('homeCreateAction')}<ArrowRight size={16} aria-hidden="true"/></Link>
          <Link className="inline-flex min-h-11 items-center gap-2 text-foreground underline underline-offset-4" to={featuredHref}>{t('homeEnter')}<ArrowRight size={16} aria-hidden="true"/></Link>
        </div>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">{t('homeLearningHint')}</p>
        <p className="home-art-note">{t('homeLearningNote')}</p>
      </div>
      <div className="home-featured">
        <Link className="home-featured-image home-demo-art" to={featuredHref} aria-label={`${t('homeEnter')}${locale === 'en' ? ': ' : '：'}${featuredTitle}`}>
          <div className="home-featured-art"><ExhibitionCover src="/demo/met-436535.jpg" srcSet="/demo/met-436535.jpg 1x, /demo/met-436535-1080.jpg 2x" title={t('demoArtwork2Title')} priority/></div>
          <span className="home-art-entry" aria-hidden="true"><ArrowUpRight size={24}/></span>
        </Link>
        <div className="home-featured-caption">
          <div className="home-poster-label" aria-live="polite" aria-atomic="true"><div className="home-poster-change">
            <p className="home-poster-work">{t('demoArtwork2Title')}</p>
            <p className="home-poster-credit">{t('demoArtwork2Artist')}<span>{t('homeDemoCaption')}</span></p>
          </div></div>
        </div>

      </div>
    </section>

    <section data-museum-reveal className="home-product" aria-labelledby="home-product-title">
      <p className="home-eyebrow">AI FOR EDUCATION</p>
      <h2 id="home-product-title">{t('homeAILearningTitle')}</h2>
      <div className="home-product-grid">
        {[
          { feature: 'Student', href: '/graduation#student' },
          { feature: 'Teacher', href: '/graduation#teacher' },
          { feature: 'Agent', href: '/demo' },
        ].map(({ feature, href }, index) => <article key={feature}>
          <span className="home-product-number" aria-hidden="true">0{index + 1}</span>
          <h3>{t(`aiEducation${feature}Title`)}</h3><p>{t(`aiEducation${feature}Desc`)}</p>
          <Link to={href} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">{t(`aiEducation${feature}Action`)}<ArrowRight size={18} aria-hidden="true"/></Link>
        </article>)}
      </div>
      <div className="home-product-links">
        <Link to="/exhibitions">{t('homeFindExhibitions')}<ArrowRight size={18} aria-hidden="true"/></Link>
      </div>
    </section>
    <section data-museum-reveal className="home-product home-use-cases" aria-labelledby="home-use-cases-title">
      <p className="home-eyebrow">PAIDEA / SPACES</p>
      <h2 id="home-use-cases-title">{t('homeUseCasesTitle')}</h2>
      <p className="home-product-summary">{t('homeUseCasesIntro')}</p>
      <div className="home-product-grid">
        {[['Education', 'art'], ['Culture', 'history'], ['Business', 'tech']].map(([useCase, cover]) => <article key={useCase}>
          <img src={`/templates/cover-${cover}.jpg`} alt={t(`home${useCase}Title`)} loading="lazy" width="1280" height="720" />
          <h3>{t(`home${useCase}Title`)}</h3><p>{t(`home${useCase}Copy`)}</p>
        </article>)}
      </div>
      <div className="home-product-links"><Link to="/virtual-gallery">{t('homeChooseSpace')}<ArrowRight size={18} aria-hidden="true"/></Link></div>
    </section>
    <section data-museum-reveal className="home-demo-collection" aria-labelledby="home-demo-title">
      <p className="home-eyebrow">PAIDEA / COLLECTION</p><h2 id="home-demo-title">{t('demoCollectionTitle')}</h2>
      <p className="home-demo-intro">{t('demoCollectionIntro')}</p>
      <div className="home-demo-grid home-demo-grid--single">{demoExhibitions.slice(0, 1).map(demo => <Link key={demo.id} className="home-demo-card" to="/demo">
        <div className="home-demo-cover"><ExhibitionCover src={`/demo/met-${demo.cover}.jpg`} title={t(demo.title)}/></div>
        <h3>{t(demo.title)}<ArrowUpRight size={18} aria-hidden="true"/></h3><p>{t(demo.description)}</p><p>{t('demoExhibitCount', { count: demo.artworks.length })}</p>
      </Link>)}</div>
      <p className="home-demo-more">{t('demoMoreGalleries')}: {demoExhibitions.slice(1).map((demo, i) => <span key={demo.id}>{i > 0 && ' · '}<Link to={`/demo?exhibition=${demo.id}`}>{t(demo.title)}</Link></span>)}</p>
    </section>
    <section data-museum-reveal className="home-create" aria-labelledby="home-create-title"><GalleryAtmosphere variant="pigment"/><p className="home-eyebrow">PAIDEA / CREATE</p><h2 id="home-create-title">{t('homeCreateTitle')}</h2><p>{t('homeCreateIntro')}</p><div className="home-actions"><Link className="home-button" to="/virtual-gallery/quick-create" onClick={() => recordJourney('create_start')}>{t('homeCreateShort')}<ArrowRight size={18} aria-hidden="true"/></Link><QuickStartTutorial/></div><ol className="home-create-steps">{['homeStep1', 'homeStep2', 'homeStep3'].map((key, i) => <li key={key}><span aria-hidden="true">0{i + 1}</span>{t(key)}</li>)}</ol></section>
  <JourneyConsent />
</div>;
}
