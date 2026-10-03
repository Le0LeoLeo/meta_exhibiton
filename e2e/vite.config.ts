import { mergeConfig } from 'vite';
import base from '../vite.config';
export default mergeConfig(base, {
  envDir: false, envPrefix: [],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_MULTIPLAYER_URL': JSON.stringify('http://127.0.0.1:5193'),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(''),
  },
  build: { outDir: '.tmp/browser-dist' },
});
