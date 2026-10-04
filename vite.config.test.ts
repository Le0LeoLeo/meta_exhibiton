import { describe, expect, it } from 'vitest';
import { getManualChunk } from './config/manualChunks';

describe('getManualChunk', () => {
  it('splits heavy 3D dependencies out of route chunks', () => {
    expect(getManualChunk('/repo/node_modules/three/build/three.module.js')).toBe('vendor-three');
    expect(getManualChunk('/repo/node_modules/three-stdlib/loaders/GLTFLoader.js')).toBe('vendor-three-stdlib');
    expect(getManualChunk('/repo/node_modules/@react-three/fiber/dist/index.js')).toBe('vendor-react-three');
    expect(getManualChunk('/repo/node_modules/@react-three/drei/index.js')).toBe('vendor-react-three');
    expect(getManualChunk('/repo/node_modules/postprocessing/build/index.js')).toBe('vendor-postprocessing');
    expect(getManualChunk('/repo/node_modules/@react-three/postprocessing/dist/index.js')).toBe('vendor-react-three-effects');
    expect(getManualChunk('/repo/node_modules/@react-three/rapier/dist/index.js')).toBe('vendor-react-three-physics');
    expect(getManualChunk('/repo/node_modules/@dimforge/rapier3d-compat/rapier.js')).toBe('vendor-physics');
  });

  it('keeps core framework and UI dependencies in stable vendor chunks', () => {
    expect(getManualChunk('/repo/node_modules/react/index.js')).toBe('vendor-react');
    expect(getManualChunk('/repo/node_modules/react-dom/client.js')).toBe('vendor-react');
    expect(getManualChunk('/repo/node_modules/react-router/dist/index.js')).toBe('vendor-router');
    expect(getManualChunk('/repo/node_modules/@radix-ui/react-dialog/dist/index.js')).toBe('vendor-ui');
    expect(getManualChunk('/repo/node_modules/lucide-react/dist/cjs/lucide-react.js')).toBe('vendor-ui');
  });

  it('does not force app modules into vendor chunks', () => {
    expect(getManualChunk('/repo/src/app/pages/Home.tsx')).toBeUndefined();
  });

  it('does not collapse unrelated dependencies into a single generic vendor chunk', () => {
    expect(getManualChunk('/repo/node_modules/some-small-package/index.js')).toBeUndefined();
  });
});
