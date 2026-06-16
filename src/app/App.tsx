import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';

export default function App() {
  return (
    <>
      <RouterProvider
        router={router}
        fallbackElement={<RouteLoadingFallback />}
      />
      <Toaster position="top-right" richColors />
    </>
  );
}
