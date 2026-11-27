import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  compressHTML: true, // preserve Astro 6 whitespace behaviour
  trailingSlash: 'always',
});
