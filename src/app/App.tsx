import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { I18nProvider } from './components/I18nProvider';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <RouterProvider
          router={router}
          fallbackElement={<RouteLoadingFallback />}
        />
        <Toaster position="top-right" richColors />
      </I18nProvider>
    </ThemeProvider>
  );
}
