import path from 'node:path';
import laravel from 'laravel-vite-plugin';
import { wp_scripts } from '@kucrut/vite-for-wp/plugins';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import imageminDist from './vite-plugin/imagemin-dist.js';
import svgStoreSprite from './vite-plugin/svgstore-sprite.js';
import iifeWrapper from './rollup-plugin/iife-wrapper.js';

export const DIST_FOLDER = 'dist';

export const BASE_VITE_CONFIG = {
    build: {
        manifest: true,
        sourcemap: true,
        emptyOutDir: false,
        rollupOptions: {
            output: {
                // disable code splitting
                manualChunks: undefined
            },
            plugins: [iifeWrapper()]
        }
    },
    plugins: [
        {
            name: 'images-pipeline',
            async closeBundle() {
                // Optimize all existing files
                await imageminDist();
                // Generate SVG Sprite
                const sprite = await svgStoreSprite();
                if (sprite) {
                    // Optimize Sprite
                    await imageminDist([sprite]);
                }
            },
        },
    ],
};

export async function generateViteConfig(target, isWatchMode) {
    process.env.APP_URL = process.env.APP_URL || process.env.DDEV_PRIMARY_URL || '';
    const hostnames = process.env.APP_HOSTNAMES || process.env.DDEV_HOSTNAME || '';
    return {
        root: target.root,
        base: isWatchMode ? '/' : './',
        plugins: [
            laravel({
                input: target.viteInput,
                publicDirectory: target.vitePublicDir,
                buildDirectory: target.viteBuildDir,
                hotFile: target.viteHotFile,
                refresh: target.viteRefreshPaths,
            }),
            wp_scripts(),
            // 1. Copy all images into dist/images
            viteStaticCopy({
                targets: target.viteImagePaths,
                //silent: true,
            }),
            ...(BASE_VITE_CONFIG.plugins || []),
        ],
        build: {
            ...BASE_VITE_CONFIG.build,
            outDir: path.relative(target.root, target.outDir),
            manifest: true,
            watch: isWatchMode ? {} : null,
        },
        clearScreen: false,
        server: {
            host: '0.0.0.0',
            port: 5173,
            allowedHosts: hostnames.split(','),
        },
    };
}
