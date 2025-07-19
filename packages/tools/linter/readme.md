# @sitchco/linter

A programmatic linting tool for the Sitchco platform. It provides a standardized way to run ESLint across the entire monorepo using the project's shared configuration.

## Overview

This package is a lightweight wrapper around the [ESLint Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api). Its primary responsibility is to instantiate and run ESLint correctly within the context of our monorepo.

### How It Works

1.  **Project Root Detection:** It uses `@sitchco/project-scanner` to reliably find the project's root directory.
2.  **Consistent Execution Context:** It configures ESLint to run from the project root (`cwd`). This is a critical step that ensures the root `eslint.config.mjs` file is always discovered and applied, no matter where or how the linting process is initiated.
3.  **Standard Output:** Linting results are printed directly to the console using ESLint's default `stylish` formatter for clear, readable feedback.
4.  **CI/CD Friendly:** The tool returns a `0` exit code on success and a `1` exit code if linting errors are found, making it suitable for use in automated workflows.

## Programmatic Usage

The package exports a single function, `runLint`, which is primarily consumed by `@sitchco/cli` to power the `sitchco lint` command.

```javascript
import { runLint } from '@sitchco/linter';

/**
 * runLint(targets?: string[]): Promise<number>
 *
 * @param {string[]} targets - Optional. An array of file or directory paths to lint.
 * If not provided, the entire project will be linted.
 * @returns {Promise<number>} A promise that resolves to an exit code (0 for success, 1 if errors were found).
 */

async function lintMyProject() {
    // Lint the entire project
    const exitCode = await runLint();

    if (exitCode === 0) {
        console.log('Linting passed!');
    } else {
        console.error('Linting failed with errors.');
    }
}

async function lintSpecificDirectory() {
    // Lint only a specific directory
    await runLint(['./modules/Demo/']);
}
```

## Configuration

This package contains **no linting rules**. It is rule-agnostic by design.

All ESLint rules, globals, plugins, and file ignores are defined in the single `eslint.config.mjs` file located at the root of the `sitchco-core` repository. This central configuration file should use the `@sitchco/eslint-config` package to import the shared rule sets.

This separation of concerns ensures that linting logic is centralized and consistently applied everywhere.
