import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

// A separate browser-only entry keeps the existing server implementation intact.
const base = process.env.PAGES_BASE_PATH || '/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('PAGES_BASE_PATH must start and end with /');
export default defineConfig({
  base,
  resolve: {alias: {'@': fileURLToPath(new URL('.', import.meta.url))}},
  define: {'process.env.NEXT_PUBLIC_STATIC_EXPORT': JSON.stringify('true')},
  plugins: [
    {
      name: 'pages-public-asset-paths',
      enforce: 'pre',
      transform(code, id) {
        // Covers JSX, template strings (animation frames) and JSON trailer images.
        // Vite handles CSS url() paths itself using the configured base.
        if (id.includes('/node_modules/') || !/\.(tsx?|jsx?|json)$/.test(id.split('?')[0])) return;
        return {code: code.replace(/(["'`])\/(media|fonts)\//g, '$1' + base + '$2/'), map: null};
      },
    },
    react(),
  ],
  build: {outDir: 'dist-pages', emptyOutDir: true},
});
