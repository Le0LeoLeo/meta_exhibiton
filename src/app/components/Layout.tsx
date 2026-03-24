import { useLocation, useOutlet } from 'react-router';
import { useEffect, useRef } from 'react';
import { Navigation } from './Navigation';
import { Footer } from './Footer';

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const prevPathRef = useRef(location.pathname);
  const isEditorPage = location.pathname.startsWith('/virtual-gallery/create');

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      {!isEditorPage && <Navigation />}

      <main className="flex-1">{outlet}</main>

      {!isEditorPage && <Footer />}
    </div>
  );
}
