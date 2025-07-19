import fs from 'node:fs/promises';
import prettier from 'prettier';
import { BaseProcessor } from './base-processor.js';

export class CssProcessor extends BaseProcessor {
    extensions = ['.css'];
    name = 'css';
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
            error.message = `CSS processing failed: ${error.message}`;
            throw error;
        }
    }
}
