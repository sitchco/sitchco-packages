import path from 'node:path';
import chalk from 'chalk';
import ProjectScanner from '@sitchco/project-scanner';
import prettier from 'prettier';
import sitchcoPrettierConfig from '@sitchco/prettier-config';
import { JsProcessor } from './processors/js-processor.js';
import { SvgProcessor } from './processors/svg-processor.js';
import { CssProcessor } from './processors/css-processor.js';
import { JsonProcessor } from './processors/json-processor.js';
import { PhpProcessor } from './processors/php-processor.js';

async function loadProcessors(prettierConfig) {
    return [
        new JsProcessor(prettierConfig),
        new SvgProcessor(prettierConfig),
        new CssProcessor(prettierConfig),
        new JsonProcessor(prettierConfig),
        new PhpProcessor(prettierConfig),
    ];
}

export async function runFormat(files = []) {
    let totalFilesProcessed = 0;
    let totalFilesChanged = 0;
    let totalFilesErrored = 0;
    console.log(chalk.blue('[sitchco-format] Starting format process...'));

    try {
        const scanner = new ProjectScanner();

        // Find project-specific prettier config (if any)
        // This ignores global configs by only accepting configs within the project root
        const configFilePath = await prettier.resolveConfigFile(scanner.projectRoot);
        let projectConfig = null;
        if (configFilePath && configFilePath.startsWith(scanner.projectRoot)) {
            // Config found within project - load it
            try {
                projectConfig = await prettier.resolveConfig(scanner.projectRoot, {
                    config: configFilePath,
                    editorconfig: false, // Don't load .editorconfig
                });
            } catch (error) {
                console.warn(
                    chalk.yellow(
                        `Warning: Could not load project Prettier config from ${configFilePath}: ${error.message}`
                    )
                );
            }
        } else if (configFilePath) {
            // Config found but outside project (global config) - explicitly ignore it
            console.log(
                chalk.blue(
                    `[sitchco-format] Ignoring global Prettier config (${configFilePath}). Using team config instead.`
                )
            );
        }

        // Always use sitchco config as base, merge project overrides if any
        const prettierConfig = {
            ...sitchcoPrettierConfig,
            ...projectConfig,
        };
        const processors = await loadProcessors(prettierConfig);
        const supportedExtensions = processors.flatMap((p) => p.extensions);
        const filesToProcess = files.length ? files : await scanner.findAllSourceFiles(supportedExtensions);
        if (!filesToProcess.length) {
            console.log(chalk.green('No files to format'));
            return 0;
        }

        totalFilesProcessed = filesToProcess.length;
        console.log(chalk.blue(`Processing ${totalFilesProcessed} file(s)`));

        const results = await Promise.all(
            filesToProcess.map(async (filePath) => {
                try {
                    const processor = processors.find((p) => p.test(filePath));
                    if (!processor) {
                        return {
                            changed: false,
                            error: null,
                        };
                    }

                    const result = await processor.processFile(filePath);
                    return {
                        changed: result.changed,
                        error: null,
                    };
                } catch (error) {
                    console.error(chalk.red(`\nError processing ${path.relative(scanner.projectRoot, filePath)}:`));
                    console.error(error.message);

                    if (error.stdout) {
                        console.error(chalk.grey(error.stdout));
                    }
                    if (error.stderr) {
                        console.error(chalk.grey(error.stderr));
                    }
                    return {
                        changed: false,
                        error,
                    };
                }
            })
        );

        results.forEach((result) => {
            if (result.error) {
                totalFilesErrored++;
            } else if (result.changed) {
                totalFilesChanged++;
            }
        });

        if (totalFilesChanged || totalFilesErrored) {
            console.log(chalk.blue('\n--- Format Summary ---'));
            console.log(chalk.blue(`Processed: ${totalFilesProcessed}`));

            if (totalFilesChanged) {
                console.log(chalk.green(`✅ Changed: ${totalFilesChanged}`));
            }
            if (totalFilesErrored) {
                console.log(chalk.red(`❌ Errors: ${totalFilesErrored}`));
            }
        }
        return totalFilesErrored > 0 ? 1 : 0;
    } catch (error) {
        console.error(chalk.red('\nFatal error during format:'), error);
        return 1;
    }
}
