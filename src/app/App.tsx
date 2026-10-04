import { RouterProvider } from 'react-router';
import { ReleaseRecovery } from './components/ReleaseRecovery';
import { router } from './routes';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/ThemeProvider';
import { I18nProvider } from './components/I18nProvider';
import { AuthSessionProvider } from './auth';
import { MotionConfig } from 'motion/react';

export default function App() {
  return (
    <MotionConfig reducedMotion="user"><ThemeProvider>
      <I18nProvider>
        <AuthSessionProvider>
          <RouterProvider router={router} />
          <ReleaseRecovery />
          <Toaster position="top-right" richColors />
        </AuthSessionProvider>
      </I18nProvider>
    </ThemeProvider></MotionConfig>
  );
}
