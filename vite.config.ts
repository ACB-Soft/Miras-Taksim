import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './', // Relative base for GitHub Pages compatibility
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          id: './',
          name: 'PWA Miras Taksim ve Fiili Kullanım Yönetimi',
          short_name: 'MirasTaksim',
          description: '20+ parsel ve çok paydaşlı miras intikalleri için Google Hibrit harita, KML ve alt KML fiili kullanım krokisi, fraction.js kesir hesabı, yapay zeka destekli taksim optimizasyonu ve noter taslakları üreten PWA uygulaması.',
          theme_color: '#1E3A8A',
          background_color: '#F8FAFC',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            {
              src: './icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
