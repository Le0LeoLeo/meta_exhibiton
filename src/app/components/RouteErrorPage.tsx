import { useEffect, useState } from 'react';
import { Home, RotateCcw } from 'lucide-react';
import { useRouteError } from 'react-router';
import { useI18n, type Locale } from './I18nProvider';
import { Button } from './ui/button';
import { RecoveryActions } from './ReleaseRecovery';
import { isChunkLoadError } from '@/app/utils/releaseRecovery';

type RouteErrorCopy = {
  heading: string;
  message: string;
  reload: string;
  home: string;
  reference: string;
};

const copy: Record<Locale, RouteErrorCopy> = {
  'zh-TW': {
    heading: '頁面暫時無法顯示',
    message: '發生未預期的錯誤。你可以重新載入頁面，或返回首頁繼續瀏覽。',
    reload: '重新載入',
    home: '返回首頁',
    reference: '錯誤參考碼',
  },
  'zh-CN': {
    heading: '页面暂时无法显示',
    message: '发生未预期的错误。你可以重新加载页面，或返回首页继续浏览。',
    reload: '重新加载',
    home: '返回首页',
    reference: '错误参考码',
  },
  en: {
    heading: 'This page is temporarily unavailable',
    message: 'An unexpected error occurred. Reload the page or return home to continue browsing.',
    reload: 'Reload page',
    home: 'Return home',
    reference: 'Error reference',
  },
};

export type RouteErrorReporter = (error: unknown, reference: string) => void;

export function reportRouteError(error: unknown, reference: string) {
  console.error('Route rendering failed', { error, reference });
}

function createErrorReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ERR-${timestamp}-${suffix}`;
}

type RouteErrorPageProps = {
  errorReference?: string;
  reloadPage?: () => void;
  reportError?: RouteErrorReporter;
};

export function RouteErrorPage({
  errorReference,
  reloadPage = () => window.location.reload(),
  reportError = reportRouteError,
}: RouteErrorPageProps = {}) {
  const error = useRouteError();
  const { locale, t } = useI18n();
  const chunkFailure = isChunkLoadError(error);
  const [reference] = useState(() => errorReference ?? createErrorReference());
  const messages = copy[locale];

  useEffect(() => {
    reportError(error, reference);
    if (chunkFailure) window.dispatchEvent(new Event('metaexb:recovery-handled'));
  }, [error, reference, reportError, chunkFailure]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-white px-6 py-16 dark:bg-stone-950">
      <section
        aria-labelledby="route-error-heading"
        className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900"
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
          {chunkFailure ? '↻' : '500'}
        </p>
        <h1
          id="route-error-heading"
          className="text-2xl font-semibold text-stone-900 dark:text-white"
        >
          {chunkFailure ? t('updateTitle') : messages.heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
          {chunkFailure ? t('updateMessage') : messages.message}
        </p>
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
          {messages.reference}: <code>{reference}</code>
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {chunkFailure ? <RecoveryActions reload={reloadPage} /> : <Button type="button" onClick={reloadPage}>
            <RotateCcw aria-hidden="true" />
            {messages.reload}
          </Button>}
          <Button asChild variant="outline">
            <a href="/">
              <Home aria-hidden="true" />
              {messages.home}
            </a>
          </Button>
        </div>
      </section>
    </main>
  );
}
