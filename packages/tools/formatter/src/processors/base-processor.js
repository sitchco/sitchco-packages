import path from 'node:path';

export class BaseProcessor {
    extensions = [];
    name = 'base';
    constructor(prettierConfig) {
        this.prettierConfig = prettierConfig;
    }

    async processFile(_filePath) {
        throw new Error('processFile() must be implemented by subclass');
    }

    test(filePath) {
        return this.extensions.includes(path.extname(filePath));
    }
}
