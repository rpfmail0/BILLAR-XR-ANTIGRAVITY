import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures assets are linked correctly on GitHub Pages
  build: {
    outDir: 'dist',
  }
});
