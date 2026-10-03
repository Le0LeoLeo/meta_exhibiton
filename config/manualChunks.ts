export function getManualChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/');
  // Vite's dynamic-import helper is shared by every route; never absorb it into 3D.
  if (normalizedId.includes('vite/preload-helper')) return 'vendor-preload';
  if (!normalizedId.includes('/node_modules/')) return undefined;

  if (normalizedId.includes('/node_modules/zustand/') || normalizedId.includes('/node_modules/use-sync-external-store/')) {
    return 'vendor-state';
  }

  if (normalizedId.includes('/node_modules/@dimforge/')) {
    return 'vendor-physics';
  }

  if (normalizedId.includes('/node_modules/@react-three/rapier/')) {
    return 'vendor-react-three-physics';
  }

  if (normalizedId.includes('/node_modules/postprocessing/')) {
    return 'vendor-postprocessing';
  }

  if (normalizedId.includes('/node_modules/@react-three/postprocessing/')) {
    return 'vendor-react-three-effects';
  }

  if (
    normalizedId.includes('/node_modules/@react-three/fiber/') ||
    normalizedId.includes('/node_modules/@react-three/drei/')
  ) {
    return 'vendor-react-three';
  }

  if (normalizedId.includes('/node_modules/three-stdlib/')) {
    return 'vendor-three-stdlib';
  }

  if (normalizedId.includes('/node_modules/three/')) {
    return 'vendor-three';
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }

  if (normalizedId.includes('/node_modules/react-router/')) {
    return 'vendor-router';
  }

  if (
    normalizedId.includes('/node_modules/@radix-ui/') ||
    normalizedId.includes('/node_modules/@mui/') ||
    normalizedId.includes('/node_modules/lucide-react/') ||
    normalizedId.includes('/node_modules/class-variance-authority/') ||
    normalizedId.includes('/node_modules/tailwind-merge/') ||
    normalizedId.includes('/node_modules/clsx/')
  ) {
    return 'vendor-ui';
  }

  if (
    normalizedId.includes('/node_modules/motion/') ||
    normalizedId.includes('/node_modules/framer-motion/')
  ) {
    return 'vendor-motion';
  }

  if (
    normalizedId.includes('/node_modules/socket.io-client/') ||
    normalizedId.includes('/node_modules/engine.io-client/')
  ) {
    return 'vendor-realtime';
  }

  if (normalizedId.includes('/node_modules/recharts/')) {
    return 'vendor-charts';
  }

  return undefined;
}
