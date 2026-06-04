import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Allow importing the widget source and the baked index from the parent package.
  server: { port: 5174, open: true, fs: { allow: ['..', '../..'] } },
});
