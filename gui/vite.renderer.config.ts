import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, '../src/lib'),
      '@types': path.resolve(__dirname, '../src/types'),
      '@schemas': path.resolve(__dirname, '../src/schemas'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});
