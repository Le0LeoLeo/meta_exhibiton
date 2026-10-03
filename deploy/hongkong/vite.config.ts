import { mergeConfig } from 'vite';
import baseConfig from '../../vite.config';
import { normalizeGoogleClientId } from '../../server/config/env.js';

const googleClientId = normalizeGoogleClientId(process.env.GOOGLE_CLIENT_ID);

export default mergeConfig(baseConfig, {
  envDir: false,
  envPrefix: [],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_MULTIPLAYER_URL': JSON.stringify('https://metaexb.com'),
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
  },
  build: { sourcemap: false },
});
