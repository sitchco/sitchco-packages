import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
            },
            formats: ['es'],
        },
        target: 'es2020',
        minify: false,
        sourcemap: true,
    },
    plugins: [
        dts({ rollupTypes: true }),
    ],
});
