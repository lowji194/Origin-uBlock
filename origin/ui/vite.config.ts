import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import {resolve} from 'node:path';
export default defineConfig({base:'./',plugins:[vue(),tailwindcss()],build:{outDir:'dist',emptyOutDir:true,rollupOptions:{input:{popup:resolve(import.meta.dirname,'popup.html'),dashboard:resolve(import.meta.dirname,'dashboard.html')}}}});
