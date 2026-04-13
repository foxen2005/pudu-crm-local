import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';
import { siiPlugin } from './vite-plugin-sii';
import * as readline from 'readline';

const WA_VM_URL    = 'http://3.143.245.74:3001';
const WA_NGROK_URL = 'https://asymptotic-lavelle-stateliest.ngrok-free.dev';

function askWaTarget(envUrl?: string): Promise<string> {
  // Si ya está definido en .env, usarlo sin preguntar
  if (envUrl) {
    console.log(`\n   ✅ WA proxy → ${envUrl} (desde .env)\n`);
    return Promise.resolve(envUrl);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│              🔌  Servidor WhatsApp (WA)                      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  [1] VM local   ${WA_VM_URL.padEnd(45)}│`);
  console.log(`│  [2] ngrok      ${WA_NGROK_URL.padEnd(45)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘');

  return new Promise((resolve) => {
    rl.question('   Opción [1/2]: ', (opt) => {
      rl.close();
      const target = opt.trim() === '2' ? WA_NGROK_URL : WA_VM_URL;
      console.log(`   ✅ WA proxy → ${target}\n`);
      resolve(target);
    });
  });
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const waTarget = await askWaTarget(env.VITE_WA_SERVER_URL);

  return {
    plugins: [react(), siiPlugin()],
    server: {
      port: 2001,
      strictPort: true,
      allowedHosts: true,
      proxy: {
        '/wa': {
          target: waTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/wa/, ''),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
