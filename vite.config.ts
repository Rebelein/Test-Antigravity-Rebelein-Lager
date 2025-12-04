import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['logo.png', 'manifest.json'], // Ensure these are cached
        manifest: {
          name: 'Rebelein LagerApp',
          short_name: 'LagerApp',
          description: 'Lagerverwaltung für Rebelein',
          theme_color: '#0f172a',
          icons: [
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Ensure we cache everything needed for offline usage
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.APP_VERSION': JSON.stringify("0.0.2"), // Sync with package.json
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      }
    }
  };
});