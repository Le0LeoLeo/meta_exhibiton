import { createElement, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { RouteErrorPage } from './components/RouteErrorPage';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { RequireAuth } from './auth';

const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => async () => {
  const mod = await loader();
  return { Component: mod.default };
};

export const router = createBrowserRouter([
  { path: '/demo/participate', lazy: lazyPage(() => import('./pages/DemoParticipation')), errorElement: createElement(RouteErrorPage), HydrateFallback: RouteLoadingFallback },
  {
    path: '/',
    Component: Layout,
    errorElement: createElement(RouteErrorPage),
    HydrateFallback: RouteLoadingFallback,
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/Home')) },
      { path: 'demo', lazy: lazyPage(() => import('./pages/DemoExhibition')), handle: { layout: 'fullscreen' } },
      { path: 'virtual-gallery', lazy: lazyPage(() => import('./pages/VirtualGallery')) },
      { path: 'exhibitions', lazy: lazyPage(() => import('./pages/Exhibitions')) },
      { path: 'support', lazy: lazyPage(() => import('./pages/Support')) },
      { path: 'privacy', lazy: lazyPage(() => import('./pages/Privacy')) },
      { path: 'terms', lazy: lazyPage(() => import('./pages/Terms')) },
      { path: 'login', lazy: lazyPage(() => import('./pages/Login')) },
      { path: 'verify-email', lazy: lazyPage(() => import('./pages/VerifyEmail')) },
      { path: 'reset-password', lazy: lazyPage(() => import('./pages/ResetPassword')) },
      { path: 'register', lazy: lazyPage(() => import('./pages/Register')) },
      { path: 'avatar', lazy: lazyPage(() => import('./pages/AvatarCustomizer')) },
      { path: 'solutions', lazy: lazyPage(() => import('./pages/Solutions')) },
      { path: 'resources', lazy: lazyPage(() => import('./pages/Resources')) },
      { path: 'competition-demo', lazy: lazyPage(() => import('./pages/CompetitionDemo')) },
      { path: 'exhibitions/:exhibitionId', lazy: lazyPage(() => import('./pages/ExhibitionView')), handle: { layout: 'fullscreen' } },
      { path: 'souvenirs/:token', lazy: lazyPage(() => import('./pages/ExhibitionSouvenir')) },
      { path: 'folders/share/:token', lazy: lazyPage(() => import('./features/exhibition-folders/SharedFolderPage')) },
      { path: 'graduation/public/:token', lazy: lazyPage(() => import('./features/graduation/GraduationPublicPage')) },
      { path: 'cv/public/:token', lazy: lazyPage(() => import('./features/cv/CvPublicPage')) },
      { path: 'virtual-gallery/share/:token', lazy: lazyPage(() => import('./pages/VirtualGalleryCreate')), handle: { layout: 'fullscreen' } },
      {
        Component: RequireAuth,
        children: [
          { path: 'graduation', lazy: lazyPage(() => import('./features/graduation/GraduationWorkspace')) },
          { path: 'cv', lazy: lazyPage(() => import('./features/cv/CvWorkspace')) },
          { path: 'graduation/classes/:classId', lazy: lazyPage(() => import('./features/graduation/GraduationClassPage')) },
          { path: 'graduation/portfolio', lazy: lazyPage(() => import('./features/graduation/GraduationPortfolio')) },
          { path: 'virtual-gallery/my-exhibitions', lazy: lazyPage(() => import('./pages/MyExhibitions')) },
          { path: 'virtual-gallery/edit-artworks', lazy: lazyPage(() => import('./pages/ExhibitionArtworkEdit')) },
          { path: 'virtual-gallery/quick-create', lazy: lazyPage(() => import('./pages/QuickExhibitionCreate')) },
          { path: 'virtual-gallery/create', lazy: lazyPage(() => import('./pages/VirtualGalleryCreate')), handle: { layout: 'fullscreen' } },
          { path: 'profile', lazy: lazyPage(() => import('./pages/Profile')) },
          { path: 'admin/exhibitions', lazy: lazyPage(() => import('./pages/ExhibitionAdmin')) },
        ],
      },
      { path: '*', lazy: lazyPage(() => import('./pages/NotFound')) },
    ],
  },
]);
