# @sitchco/formatter

A programmatic formatting tool for the Sitchco platform. It provides a single, extensible interface for formatting various file types like JavaScript, CSS, and SVG, each with its own specialized processor.

## Overview

The `@sitchco/formatter` is designed to be the single source of truth for code formatting within the monorepo. Instead of running multiple formatters, you can use this package's `runFormat` function, which automatically discovers supported files and applies the correct formatting rules based on file type.

It uses a processor-based architecture:

1.  It scans the project for files using `@sitchco/project-scanner`.
2.  For each discovered file, it selects the appropriate processor based on the file extension.
3.  Each processor applies a specific set of tools and configurations to format the file.

## Supported File Types & Processors

### JavaScript (`.js`, `.mjs`)

JavaScript files undergo a powerful multi-pass formatting process to ensure maximum consistency:

1.  **Prettier Pass 1:** The file is first formatted with the project's shared Prettier configuration.
2.  **ESLint Fix Pass:** `eslint --fix` is run on the output, applying more complex stylistic rules (like statement padding and object formatting) that go beyond Prettier's scope.
3.  **Prettier Pass 2:** The file is run through Prettier one last time to clean up any formatting inconsistencies introduced by the ESLint auto-fix.

### CSS (`.css`)

CSS files are formatted using the project's shared Prettier configuration.

### SVG (`.svg`)

SVG files are optimized and pretty-printed using [SVGO](https://github.com/svg/svgo). This process reduces file size by removing redundant information and standardizes the code style for better readability and maintenance.

### PHP (`.php`)

*Note: A processor for PHP (`php-processor.js`) exists as a placeholder, but it is not yet implemented. PHP files will be skipped by the formatter for now.*

## Programmatic Usage

This package exports a single function, `runFormat`, which is primarily consumed by `@sitchco/cli` but can be used in other scripts.

```javascript
import { runFormat } from '@sitchco/formatter';

/**
 * runFormat(files?: string[]): Promise<number>
 *
 * @param {string[]} files - Optional. An array of file paths to format.
 * If not provided, all supported files in the project will be discovered and formatted.
 * @returns {Promise<number>} A promise that resolves to an exit code (0 for success, 1 if errors occurred).
 */

async function formatMyProject() {
    // Format all supported files in the project
    const exitCode = await runFormat();

    if (exitCode === 0) {
        console.log('Formatting complete!');
    } else {
        console.error('Formatting failed for one or more files.');
    }
}

async function formatSpecificFiles() {
    // Format only a specific subset of files
    await runFormat(['./path/to/file.js', './path/to/styles.css']);
}
```

## Configuration

The formatter is designed to work with zero configuration. It automatically resolves the project's Prettier configuration (e.g., from `.prettierrc.json`) and uses the shared `@sitchco/eslint-config` for its ESLint fix pass.
