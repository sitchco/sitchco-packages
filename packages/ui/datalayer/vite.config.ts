import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                utm: resolve(__dirname, 'src/utm.ts'),
                outbound: resolve(__dirname, 'src/outbound.ts'),
                ecommerce: resolve(__dirname, 'src/ecommerce.ts'),
            },
            formats: ['es'],
        },
        target: 'es2020',
        minify: false,
        sourcemap: true,
    },
});
