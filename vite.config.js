import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Firebaseなど更新頻度の低いライブラリを別ファイルに分ける
        // → アプリ側の修正だけならライブラリは再ダウンロードされず、起動が速い
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
});
