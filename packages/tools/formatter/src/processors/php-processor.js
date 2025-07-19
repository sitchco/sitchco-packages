import fs from 'node:fs/promises';
import prettier from 'prettier';
import * as phpPlugin from '@prettier/plugin-php';
import { BaseProcessor } from './base-processor.js';

export class PhpProcessor extends BaseProcessor {
    extensions = ['.php'];
    name = 'php';

    async processFile(filePath) {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let content = originalContent;
        let changed = false;

        try {
            content = await prettier.format(content, {
                ...this.prettierConfig,
                filepath: filePath,
                plugins: [phpPlugin],
            });

            if (content !== originalContent) {
                await fs.writeFile(filePath, content, 'utf8');
                changed = true;
            }
            return { changed };
        } catch (error) {
            error.message = `PHP processing failed: ${error.message}`;
            throw error;
        }
    }
}
