import path from 'node:path';
import laravel from 'laravel-vite-plugin';
import postcssNested from 'postcss-nested';
import postcssCustomMedia from 'postcss-custom-media';
import { wp_scripts } from '@kucrut/vite-for-wp/plugins';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import imageminDist from './vite-plugin/imagemin-dist.js';
import svgStoreSprite from './vite-plugin/svgstore-sprite.js';
import iifeWrapper from './rollup-plugin/iife-wrapper.js';
import { IMAGE_FILE_REGEX, IMAGES_DIST_SUBFOLDER } from '@sitchco/project-scanner';

export const DIST_FOLDER = 'dist';

export const BASE_VITE_CONFIG = {
    build: {
        manifest: true,
        sourcemap: true,
        emptyOutDir: false,
        rollupOptions: {
            output: {
                // disable code splitting
                manualChunks: undefined,
                // Add module name prefix to output files
                entryFileNames: (chunkInfo) => {
                    if (!chunkInfo.facadeModuleId) {
                        return 'assets/[name]-[hash].js';
                    }

                    // Extract module name from path
                    // Path looks like: /path/to/modules/ModuleName/assets/scripts/main.js
                    const pathParts = chunkInfo.facadeModuleId.split('/');
                    const modulesIndex = pathParts.indexOf('modules');
                    const moduleName =
                        modulesIndex >= 0 && modulesIndex + 1 < pathParts.length
                            ? pathParts[modulesIndex + 1].toLowerCase()
                            : 'unknown';
                    return `assets/${moduleName}-[name]-[hash].js`;
                },
                assetFileNames: (assetInfo) => {
                    // For images, put in images subdirectory
                    if (assetInfo.name.match(IMAGE_FILE_REGEX)) {
                        return `${IMAGES_DIST_SUBFOLDER}/[name]-[hash][extname]`;
                    }
                    // For CSS files, extract module name from originalFileName
                    if (assetInfo.name && assetInfo.name.endsWith('.css') && assetInfo.originalFileName) {
                        const pathParts = assetInfo.originalFileName.split('/');
                        const modulesIndex = pathParts.indexOf('modules');
                        if (modulesIndex >= 0 && modulesIndex + 1 < pathParts.length) {
                            const moduleName = pathParts[modulesIndex + 1].toLowerCase();
                            // Extract just the filename without path
                            const filename = pathParts[pathParts.length - 1].replace('.css', '');
                            return `assets/${moduleName}-${filename}-[hash][extname]`;
                        }
                    }
                    // Default naming for non-CSS assets (images, fonts, etc.)
                    return 'assets/[name]-[hash][extname]';
                },
            },
            plugins: [iifeWrapper()],
        },
    },
    plugins: [
        {
            name: 'images-pipeline',
            async closeBundle() {
                // Optimize all existing files
                await imageminDist();
                // Generate SVG Sprite
                await svgStoreSprite();
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
        css: {
            postcss: {
                plugins: [postcssNested(), postcssCustomMedia()],
            },
        },
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
