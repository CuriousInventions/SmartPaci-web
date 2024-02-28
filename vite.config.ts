import { defineConfig } from 'vite';;
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        VitePWA({ registerType: 'autoUpdate' })
    ],
    root: 'src/',
    build: {
        // outDir is relative to the root config above.
        outDir: '../dist',
        emptyOutDir: true,
    },
});
