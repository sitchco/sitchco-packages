# @sitchco/project-scanner

A utility class for scanning a Sitchco WordPress project to discover modules, asset entry points, and other key directories based on established conventions.

## Overview

This package provides a programmatic interface for navigating the project structure. It is the foundational discovery tool used by other build scripts like `@sitchco/module-builder` and `@sitchco/formatter` to get a reliable list of files and paths to operate on.

It is built on a "convention over configuration" philosophy, meaning it understands the project's layout without needing complex configuration.

## Core Directory Conventions

The scanner's logic is based on the following directory structure:

* **Module Directory:** Any direct subdirectory located inside the top-level `modules/` folder is considered a module.
* **Asset Entry Points:** Within each module, the scanner looks for buildable assets (`.js`, `.mjs`, `.scss`, `.css`) in these specific locations:
    * The module's root
    * `assets/scripts/`
    * `assets/styles/`
    * The root of any block within `blocks/`
    * The `assets/` directory of any block within `blocks/`
* **WordPress Web Root:** The scanner can traverse up the directory tree to locate the folder that contains `wp-content`, identifying it as the web root.

## Programmatic Usage (API)

The main export is the `ProjectScanner` class.

### `new ProjectScanner(options?)`

Creates a new scanner instance.

```javascript
import ProjectScanner from '@sitchco/project-scanner';

// Create a scanner instance starting from the current working directory
const scanner = new ProjectScanner();

// Or, create an instance with a specific project root
const scannerWithCustomRoot = new ProjectScanner({
    projectRoot: '/path/to/sitchco-core',
});
```

**Options:**

* `projectRoot` (string): The absolute path to the project's root directory. Defaults to `process.cwd()`.
* `ignorePatterns` (string[]): An array of glob patterns to ignore during scans.

### Public Methods

All methods return a `Promise`.

* `.getModuleDirs(): Promise<string[]>`
  Returns an array of absolute paths to all discovered module directories (e.g., `['.../sitchco-core/modules/Demo']`).

* `.getEntrypoints(): Promise<string[]>`
  Returns a flattened array of absolute paths to all discoverable asset entry points across all modules.

* `.getWebRoot(): Promise<string>`
  Scans upwards from the project root to find and return the absolute path to the WordPress web root (the directory containing `wp-content`).

* `.findAllSourceFiles(extensions: string[]): Promise<string[]>`
  Finds all files with the given extensions (e.g., `['.php', '.svg']`) within the **entire project**, respecting ignore patterns.

* `.findModuleSourceFiles(extensions: string[]): Promise<string[]>`
  Similar to `findAllSourceFiles`, but scopes the search to only the **discovered module directories**.

* `.cleanBuildArtifacts(): Promise<void>`
  Finds and removes all build artifact directories (`dist/`, `.vite/`) within the project.

* `.clearCache(): void`
  Clears the internal cache for module directories, entry points, and the web root, forcing a fresh scan on the next method call.
