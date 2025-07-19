import { optimize } from 'svgo';
import fs from 'node:fs/promises';
import { BaseProcessor } from './base-processor.js';

export class SvgProcessor extends BaseProcessor {
    extensions = ['.svg'];
    name = 'svg';
    svgoConfig = {
        multipass: true,
        js2svg: {
            indent: 4,
            pretty: true,
        },
        plugins: [
            {
                name: 'preset-default',
                params: { overrides: { convertShapeToPath: false } },
            },
            'convertStyleToAttrs',
            {
                name: 'inlineStyles',
                params: {
                    onlyMatchedOnce: false,
                    removeMatchedSelectors: true,
                },
            },
        ],
    };

    async processFile(filePath) {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let content = originalContent;
        let changed = false;

        try {
            const result = optimize(content, {
                path: filePath,
                ...this.svgoConfig,
            });
            if (result.error) {
                console.error(`❌ SVGO Optimization Error in ${filePath}: ${result.error}`);
                throw result.error;
            }

            content = result.data;

            if (content !== originalContent) {
                await fs.writeFile(filePath, content, 'utf8');
                changed = true;
            }
            return { changed };
        } catch (error) {
            error.message = `SVG processing failed: ${error.message}`;
            throw error;
        }
    }
}
