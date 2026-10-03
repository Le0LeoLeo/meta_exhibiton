import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { I18nProvider } from '@/app/components/I18nProvider';
import { Footer } from '@/app/components/Footer';
import Home from '@/app/pages/Home';

/** Public, anonymous content only; the browser mounts the interactive app normally. */
export function renderHome() {
  return renderToStaticMarkup(<StaticRouter location="/"><I18nProvider>
    <div className="museum-shell museum-pages">
      <header className="home-navigation"><a className="home-brand inline-flex min-h-16 items-center px-6" href="/">Paidea</a></header>
      <main><Home /></main><Footer />
    </div>
  </I18nProvider></StaticRouter>);
}
