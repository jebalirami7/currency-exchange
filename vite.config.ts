import { defineConfig } from 'vite';

/**
 * `base` must match the GitHub Pages sub-path (https://<user>.github.io/<repo>/).
 * The deploy workflow passes the repository name in via BASE_PATH so that a
 * rename of the repository does not silently break every asset URL.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
