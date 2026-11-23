import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {localApi} from './local/api.mjs';
export default defineConfig(({mode})=>{const settings=loadEnv(mode,process.cwd(),'');return {base:mode==='hosted'?'/':settings.PUBLIC_BASE||'./',plugins:[react(),localApi()],server:{host:'0.0.0.0',port:5173,strictPort:true},preview:{host:'0.0.0.0',port:5173,strictPort:true},build:{outDir:'dist',emptyOutDir:true}}});

