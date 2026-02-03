import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: false, // Don't delete dist from main build
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'content_widget/index.jsx'),
      output: {
        entryFileNames: 'content_widget.js',
        format: 'iife', // Self-contained script
        name: 'SmartAudioWidget',
        extend: true,
        inlineDynamicImports: true // Forces everything into one file
      }
    }
  }
});
