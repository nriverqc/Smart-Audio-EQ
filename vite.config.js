import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'IconoEcualizador.png', dest: '.' },
        { src: 'premium_landing.html', dest: '.' },
        { src: '_locales', dest: '.' }
      ]
    })
  ],
  base: './', // CRUCIAL para extensiones: usa rutas relativas
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        offscreen: resolve(__dirname, 'offscreen.html'),
        background: resolve(__dirname, 'background.js'),
        content: resolve(__dirname, 'content.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
