# @sitchco/cli

Unified command-line interface for Sitchco WordPress platform development.

## Overview

The `@sitchco/cli` package provides a single `sitchco` command that orchestrates all development tooling for WordPress projects following Sitchco platform conventions. It acts as a wrapper around specialized packages for linting, formatting, building, and more.

**Key Features:**
- Module-based asset building with Vite
- Automatic code formatting and linting
- Git hooks integration via Husky
- Environment adapters for DDEV, local, and other environments
- Project scanning and module discovery

## Installation

### For WordPress Projects

Install as a development dependency in your WordPress theme or plugin:

```bash
npm install --save-dev @sitchco/cli
# or
pnpm add -D @sitchco/cli
```

### For Monorepo Contributors

If you're working on the tooling packages themselves:

```bash
# From monorepo root
pnpm install
```

The `sitchco` command is available via pnpm workspaces.

## Commands

### Asset Building

#### `sitchco build`

Builds all module and block assets for production. Compiles and optimizes JavaScript, CSS, and other assets into the `dist/` folder with a `manifest.json`.

```bash
sitchco build
```

#### `sitchco dev`

Starts the Vite development server with Hot Module Replacement (HMR). Watches for file changes and automatically rebuilds assets. Creates a `hot` file in `dist/` to signal dev mode to WordPress.

```bash
sitchco dev
```

#### `sitchco clean`

Removes build artifacts from the `dist/` directory.

```bash
sitchco clean
```

### Code Quality

#### `sitchco lint [targets...]`

Runs ESLint on project files. Optionally specify file or directory paths to lint specific targets.

```bash
# Lint entire project
sitchco lint

# Lint specific directory
sitchco lint ./modules/Demo/

# Lint specific files
sitchco lint ./modules/Demo/assets/scripts/main.js
```

#### `sitchco format [files...]`

Formats code using Prettier (with PHP support), SVGO for SVGs, and other formatters. Optionally specify files to format specific targets.

```bash
# Format all files
sitchco format

# Format specific files
sitchco format ./modules/Demo/assets/scripts/main.js
```

### Git Hooks

#### `sitchco prepare`

Installs Husky git hooks. This is typically called automatically via the `prepare` npm script during `npm install`.

```bash
sitchco prepare
```

Add to your `package.json`:
```json
{
  "scripts": {
    "prepare": "sitchco prepare"
  }
}
```

#### `sitchco pre-commit`

Runs pre-commit checks: formats and lints all staged files. This is typically called automatically by the `.husky/pre-commit` hook.

```bash
sitchco pre-commit
```

**What it does:**
1. Checks for staged files
2. Formats them with Prettier
3. Re-stages the formatted files
4. Runs ESLint on the workspace
5. Blocks commit if linting fails

### Environment Adapters

#### `sitchco run <command> [args...]`

Executes commands with environment-agnostic context detection. Automatically detects if you're in a DDEV environment or local development and adjusts command execution accordingly.

```bash
# Run composer in appropriate environment
sitchco run composer install

# Run WP-CLI commands
sitchco run wp plugin list
```

**Options:**
- `-a, --adapter <name>` - Force specific adapter (ddev, local, etc.)
- `-e, --enforce` - Make fallback failures exit non-zero
- `-v, --verbose` - Show detailed execution information

#### `sitchco adapters`

Lists available environment adapters and current environment information.

```bash
sitchco adapters
```

Shows:
- Available adapters (DDEV, local, etc.)
- Current environment detection
- Selected adapter and its priority

## Usage Examples

### Basic WordPress Theme Development

```bash
# Install CLI
npm install --save-dev @sitchco/cli husky

# Add prepare script to package.json
# {
#   "scripts": {
#     "prepare": "sitchco prepare"
#   }
# }

# Install hooks
npm install

# Start development
sitchco dev

# In another terminal, make changes...
# Git hooks will auto-format and lint on commit

# Build for production
sitchco build
```

### DDEV Environment

```bash
# CLI automatically detects DDEV
sitchco run composer install    # Runs inside DDEV container
sitchco run wp plugin list       # Runs WP-CLI inside DDEV

# Check environment detection
sitchco adapters
```

## Architecture

The CLI delegates to specialized packages:

- **`@sitchco/module-builder`** - Asset building with Vite
- **`@sitchco/linter`** - ESLint runner
- **`@sitchco/formatter`** - Multi-format code formatter
- **`@sitchco/project-scanner`** - Module discovery
- **Adapter System** - Environment-aware command execution

## Configuration

The CLI uses shared configurations:
- **`@sitchco/eslint-config`** - ESLint rules
- **`@sitchco/prettier-config`** - Prettier rules

These are automatically applied when using the CLI commands.

## Requirements

- **Node.js** >= 18
- **npm** or **pnpm**

## License

ISC
