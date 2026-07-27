import { createElement, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { RouteErrorPage } from './components/RouteErrorPage';
import { RequireAuth } from './auth';

const lazyPage = (loader: () => Promise<{ default: ComponentType }>) => async () => {
  const mod = await loader();
  return { Component: mod.default };
};

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    errorElement: createElement(RouteErrorPage),
    HydrateFallback: () => null,
    children: [
      { index: true, lazy: lazyPage(() => import('./pages/Home')) },
      { path: 'virtual-gallery', lazy: lazyPage(() => import('./pages/VirtualGallery')) },
      { path: 'exhibitions', lazy: lazyPage(() => import('./pages/Exhibitions')) },
      { path: 'support', lazy: lazyPage(() => import('./pages/Support')) },
      { path: 'login', lazy: lazyPage(() => import('./pages/Login')) },
      { path: 'register', lazy: lazyPage(() => import('./pages/Register')) },
      { path: 'solutions', lazy: lazyPage(() => import('./pages/Solutions')) },
      { path: 'resources', lazy: lazyPage(() => import('./pages/Resources')) },
      { path: 'competitions', lazy: lazyPage(() => import('./pages/Competitions')) },
      { path: 'competitions/:competitionId', lazy: lazyPage(() => import('./pages/CompetitionDetail')) },
      { path: 'exhibitions/:exhibitionId', lazy: lazyPage(() => import('./pages/ExhibitionView')), handle: { layout: 'fullscreen' } },
      { path: 'souvenirs/:token', lazy: lazyPage(() => import('./pages/ExhibitionSouvenir')) },
      { path: 'virtual-gallery/share/:token', lazy: lazyPage(() => import('./pages/VirtualGalleryCreate')), handle: { layout: 'fullscreen' } },
      { path: 'growth-memories/share/:token', lazy: lazyPage(() => import('./pages/GrowthMemoriesShare')), handle: { layout: 'fullscreen' } },
      { path: 'growth-memories/share/:token/summary', lazy: lazyPage(() => import('./pages/GrowthMemoriesShare')), handle: { layout: 'fullscreen' } },
      {
        Component: RequireAuth,
        children: [
          { path: 'virtual-gallery/my-exhibitions', lazy: lazyPage(() => import('./pages/MyExhibitions')) },
          { path: 'virtual-gallery/create', lazy: lazyPage(() => import('./pages/VirtualGalleryCreate')), handle: { layout: 'fullscreen' } },
          { path: 'virtual-gallery/upload', lazy: lazyPage(() => import('./pages/ExhibitionUploadPlatform')), handle: { layout: 'fullscreen' } },
          { path: 'growth-memories', lazy: lazyPage(() => import('./pages/GrowthMemories')) },
          { path: 'growth-memories/recommendations', lazy: lazyPage(() => import('./pages/GrowthRecommendation')) },
          { path: 'growth-memories/3d/:exhibitId', lazy: lazyPage(() => import('./pages/GrowthMemories3D')) },
          { path: 'profile', lazy: lazyPage(() => import('./pages/Profile')) },
          { path: 'admin/exhibitions', lazy: lazyPage(() => import('./pages/ExhibitionAdmin')) },
          { path: 'admin/competitions', lazy: lazyPage(() => import('./pages/CompetitionAdmin')) },
        ],
      },
      { path: '*', lazy: lazyPage(() => import('./pages/NotFound')) },
    ],
  },
]);
