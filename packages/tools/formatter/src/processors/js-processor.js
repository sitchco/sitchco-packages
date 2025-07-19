import { ESLint } from 'eslint';
import prettier from 'prettier';
import fs from 'node:fs/promises';
import stylistic from '@stylistic/eslint-plugin';
import { BaseProcessor } from './base-processor.js';

export class JsProcessor extends BaseProcessor {
    extensions = ['.js', '.mjs'];

    name = 'javascript';
    constructor(prettierConfig) {
        super(prettierConfig);
        this.eslint = new ESLint({
            fix: true,
            overrideConfig: [
                {
                    plugins: {
                        '@stylistic': stylistic,
                    },
                    rules: {
                        '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
                        '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
                        '@stylistic/object-curly-newline': [
                            'error',
                            {
                                minProperties: 2,
                                multiline: true,
                                consistent: true,
                            },
                        ],
                        '@stylistic/array-bracket-newline': [
                            'error',
                            {
                                multiline: true,
                                minItems: 2,
                            },
                        ],
                        '@stylistic/padding-line-between-statements': [
                            'error',
                            {
                                blankLine: 'always',
                                prev: '*',
                                next: ['multiline-block-like', 'block-like', 'if', 'export', 'function'],
                            },
                            {
                                blankLine: 'always',
                                prev: [
                                    'multiline-block-like',
                                    'block-like',
                                    'multiline-expression',
                                    'if',
                                    'export',
                                    'function',
                                    'import',
                                ],
                                next: '*',
                            },
                            {
                                blankLine: 'never',
                                prev: ['const', 'let', 'var', 'if'],
                                next: ['if'],
                            },
                            {
                                blankLine: 'never',
                                prev: '*',
                                next: 'return',
                            },
                            {
                                blankLine: 'never',
                                prev: ['import'],
                                next: ['import'],
                            },
                        ],
                    },
                },
            ],
        });
    }

    async processFile(filePath) {
        const originalContent = await fs.readFile(filePath, 'utf8');
        let content = originalContent;
        let changed = false;

        try {
            content = await prettier.format(content, {
                ...this.prettierConfig,
                filepath: filePath,
            });

            const results = await this.eslint.lintText(content, { filePath });
            const output = results[0]?.output;
            content = output || content;
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
            error.message = `JS processing failed: ${error.message}`;
            throw error;
        }
    }
}
