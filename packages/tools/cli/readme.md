# @sitchco/cli

A unified command-line interface (CLI) for Sitchco WordPress platform development. This tool provides a single, consistent command (`sitchco`) to run various development and build tasks like linting, formatting, and asset building.

## Overview

The `sitchco` CLI is designed to simplify the development workflow by acting as a wrapper around other specialized tooling packages within the monorepo. It orchestrates the following packages:

* `@sitchco/linter`: For running ESLint.
* `@sitchco/formatter`: For formatting code with Prettier and other tools.
* `@sitchco/module-builder`: For building and watching assets with Vite.

## Installation

This package is a core part of the `sitchco-core` monorepo and is not intended for standalone installation. It is automatically installed and available within the project when you run:

```bash
pnpm install
```

The `sitchco` command is then available to be run via pnpm from the project root.

## Commands

All commands are run from the root of the `sitchco-core` repository.

### `sitchco build`

Builds all module and block assets for production. This command compiles JavaScript and CSS, ready for deployment.

```bash
pnpm sitchco build
```

### `sitchco dev`

Starts the development server. This will watch all relevant module and block assets, rebuilding them on change and enabling Hot Module Replacement (HMR) for a seamless development experience.

```bash
pnpm sitchco dev
```

### `sitchco lint [targets...]`

Runs the ESLint process on project files. You can optionally specify one or more file or directory paths to lint; otherwise, it will lint the entire project.

```bash
# Lint the entire project
pnpm sitchco lint

# Lint a specific directory
pnpm sitchco lint ./modules/Demo/
```

### `sitchco format [files...]`

Formats project files using the shared Prettier configuration. You can optionally specify one or more file or directory paths to format.

```bash
# Format all supported files in the project
pnpm sitchco format

# Format a specific file
pnpm sitchco format ./modules/Demo/assets/scripts/main.js
```

### `sitchco clean`

Removes all build artifacts created by the build process, such as the `dist/` and `.vite/` directories.

```bash
pnpm sitchco clean
```
