import { ESLint } from 'eslint';
import chalk from 'chalk';
import ProjectScanner from '@sitchco/project-scanner';

export async function runLint(targets = []) {
    const scanner = new ProjectScanner();
    console.log(chalk.blue(`Scanning for modules in: ${scanner.projectRoot}/*`));

    try {
        // Initialize ESLint programmatically, just like the formatter.
        // It will automatically find the eslint.config.js at the project root.
        const eslint = new ESLint({
            // Set the cwd to ensure ESLint looks for the config from the project root.
            cwd: scanner.projectRoot,
        });

        const filesToLint = targets.length > 0 ? targets : [scanner.projectRoot];
        if (!filesToLint.length) {
            console.log(chalk.green('No files found to lint.'));
            return 0; // exit code 0
        }

        console.log(chalk.blue(`Running ESLint on project...`));

        // Use the lintFiles method to lint the specified files.
        const results = await eslint.lintFiles(filesToLint);

        // Get the default formatter to print the results to the console.
        const formatter = await eslint.loadFormatter('stylish');
        const resultText = await formatter.format(results);

        // Check if there are any errors.
        const hasErrors = results.some((result) => result.errorCount > 0);
        if (resultText) {
            console.log(resultText);
        }
        if (!hasErrors && !resultText) {
            console.log(chalk.green('✓ No linting errors found.'));
        }
        // Return an exit code of 1 if there were errors, 0 otherwise.
        return hasErrors ? 1 : 0;
    } catch (error) {
        console.error(chalk.red('An error occurred during linting:'), error);
        return 1;
    }
}
