import fs from 'node:fs/promises';
import prettier from 'prettier';
import { BaseProcessor } from './base-processor.js';

export class JsonProcessor extends BaseProcessor {
    extensions = ['.json'];
    name = 'json';

    async processFile(filePath) {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let content = originalContent;
        let changed = false;

        try {
            content = await prettier.format(content, {
                ...this.prettierConfig,
                filepath: filePath,
            });

            if (content !== originalContent) {
                await fs.writeFile(filePath, content, 'utf8');
                changed = true;
            }
            return { changed };
        } catch (error) {
            error.message = `JSON processing failed: ${error.message}`;
            throw error;
        }
    }
}
