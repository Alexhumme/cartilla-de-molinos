import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = resolve(import.meta.dirname);
const distDir = resolve(rootDir, 'dist');

function copyRuntimeAssets() {
    return {
        name: 'copy-runtime-assets',
        closeBundle() {
            const assetsSource = resolve(rootDir, 'assets');
            const assetsTarget = resolve(distDir, 'assets');
            const phaserSource = resolve(rootDir, 'phaser.js');
            const phaserTarget = resolve(distDir, 'phaser.js');

            if (existsSync(assetsSource)) {
                cpSync(assetsSource, assetsTarget, { recursive: true });
            }

            if (existsSync(phaserSource)) {
                cpSync(phaserSource, phaserTarget);
            }
        },
    };
}

export default defineConfig({
    base: './',
    plugins: [
        copyRuntimeAssets(),
    ],
});
