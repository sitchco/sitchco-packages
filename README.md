# Sitchco WordPress Platform Tooling

A monorepo containing development tools and build infrastructure for the Sitchco WordPress platform.

## Overview

This repository provides a unified suite of development tools for WordPress projects using the Sitchco platform conventions. The tools are published as npm packages and can be used both within this monorepo and in external WordPress projects.

**Key Features:**
- **Unified CLI** (`@sitchco/cli`) - Single command interface for all tooling
- **Module-based builds** - Convention-based asset discovery and compilation with Vite
- **Consistent code quality** - Shared ESLint and Prettier configurations
- **Git hooks** - Automatic formatting and linting via Husky integration
- **Environment adapters** - Smart command execution across development environments (DDEV, local, etc.)

**Published Packages:** All packages under `@sitchco/*` scope are published to npm and can be installed in any project.

---

## For Contributors

Working on the tooling packages themselves within this monorepo.

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8 (for workspace support)

### Getting Started

```bash
# Clone and install
pnpm install

# Run development builds
pnpm dev

# Run linting
pnpm lint

# Run formatting
pnpm format

# Run tests
pnpm test
```

### Monorepo Structure

```
sitchco-packages/
├── packages/
│   ├── tools/              # Development tools
│   │   ├── cli/            # @sitchco/cli - Unified command interface
│   │   ├── linter/         # @sitchco/linter - ESLint runner
│   │   ├── formatter/      # @sitchco/formatter - Code formatter
│   │   ├── module-builder/ # @sitchco/module-builder - Vite build engine
│   │   └── project-scanner/# @sitchco/project-scanner - Module discovery
│   └── configs/            # Shared configurations
│       ├── eslint-config/  # @sitchco/eslint-config - ESLint rules
│       └── prettier-config/# @sitchco/prettier-config - Prettier rules
├── docs/                   # Documentation
└── scripts/                # Build and release scripts
```

### Release Process

This monorepo uses [Changesets](https://github.com/changesets/changesets) for version management.

**During development:**
```bash
# After making changes, create a changeset
pnpm changeset

# Commit the changeset with your code
git add .changeset/*.md
git commit -m "feat: your feature"
```

**When releasing:**
```bash
# Bump versions and update CHANGELOGs
pnpm version

# Commit and push
git add .
git commit -m "Version Packages"
git push

# Create GitHub release (triggers npm publish)
pnpm release              # Date-based: 2025-10-11
pnpm release platform-v3  # Custom tag for special releases
```

See [docs/release-process.md](docs/release-process.md) for detailed instructions.

### Installation

Install the CLI and optional Husky for git hooks:

```bash
npm install --save-dev @sitchco/cli husky
# or
pnpm add -D @sitchco/cli husky
```

### Basic Usage

The `sitchco` command provides access to all tooling:

```bash
# Build assets for production
sitchco build

# Start development server with HMR
sitchco dev

# Lint your code
sitchco lint

# Format your code
sitchco format

# Clean build artifacts
sitchco clean
```

### Git Hooks Setup

Enable automatic formatting and linting on commit:

**1. Add the prepare script to your `package.json`:**
```json
{
  "scripts": {
    "prepare": "sitchco prepare"
  }
}
```

**2. Run installation:**
```bash
npm install
```

This creates a `.husky/pre-commit` hook that automatically formats and lints staged files before each commit.

See [docs/husky-support.md](docs/husky-support.md) for details.

### How It Works

The tooling uses a **convention-based approach** to discover and build assets:

1. **Module Discovery**: Scans for subdirectories within a `modules/` folder
2. **Asset Compilation**: Uses Vite to compile JavaScript, CSS, and other assets
3. **Output**: Generates a `dist/` folder with optimized assets and a `manifest.json`
4. **HMR Support**: In dev mode, creates a `hot` file for Vite dev server detection

Your WordPress code should check for the `hot` file to determine whether to load assets from the Vite dev server (development) or from the `dist/` folder (production).

---

## Technology Stack

The platform's tooling leverages:

- **Node.js (>=18)** - Runtime environment
- **pnpm** - Package manager with workspace support
- **Vite** - Fast JS/CSS bundling and development server with HMR
- **laravel-vite-plugin** - Integrates Vite with PHP environments, handles manifest generation and asset URLs
- **sass-embedded** - Sass/SCSS compilation
- **ESLint** - JavaScript linting with `@sitchco/eslint-config`
- **Prettier** - Code formatting with `@sitchco/prettier-config`
- **SVGO** - SVG optimization (used in `@sitchco/formatter`)
- **Vitest** - Unit and integration testing
- **Changesets** - Version management and changelog generation

## Package Architecture

### Core Packages

#### `@sitchco/cli`
Unified command-line interface providing a single `sitchco` command for all development tasks. Delegates to specialized packages and includes environment adapter system for smart command execution across different development environments (DDEV, local, etc.).

**Commands:** `build`, `dev`, `lint`, `format`, `clean`, `prepare`, `pre-commit`, `run`, `adapters`

#### `@sitchco/module-builder`
Core build engine that orchestrates Vite to compile JavaScript, CSS, and other assets. Uses `@sitchco/project-scanner` to discover modules and their entry points, then compiles everything into a `dist/` folder with manifest generation.

**Features:** HMR support, SVG sprite generation, module-based chunking, WordPress-specific optimizations

#### `@sitchco/project-scanner`
Discovers modules by scanning for subdirectories within the `modules/` folder. Identifies entry points (JS/SCSS), finds the WordPress web root, and provides file-finding utilities to other tools.

**Conventions:** Any subdirectory of `modules/` is treated as a module. Entry points are discovered automatically based on standard filenames.

#### `@sitchco/linter`
Programmatic ESLint runner that ensures consistent linting across projects. Automatically uses the shared `@sitchco/eslint-config` for consistent code quality.

#### `@sitchco/formatter`
Multi-format code formatter using a processor-based system:
- **Prettier** for JavaScript, CSS, JSON, Markdown
- **SVGO** for SVG optimization
- **Prettier PHP Plugin** for PHP formatting

#### `@sitchco/eslint-config`
Shared ESLint configuration with rules optimized for WordPress development. Includes support for React/JSX, modern JavaScript, and WordPress globals.

#### `@sitchco/prettier-config`
Shared Prettier configuration ensuring consistent code formatting across all projects.

## Development Workflow

### Convention-Based Module Discovery

The tooling automatically discovers modules using a simple convention:

1. Any subdirectory within `modules/` is treated as a module
2. Entry points are discovered based on standard filenames (e.g., `assets/scripts/main.js`, `assets/styles/main.scss`)
3. All discovered assets are compiled into a single `dist/` folder with a `manifest.json`

### Asset Structure & Manifest

**Development mode (`sitchco dev`):**
- Vite dev server runs on `http://localhost:5173`
- Creates a `hot` file in `dist/` to signal dev mode
- Enables Hot Module Replacement (HMR) for instant updates

**Production mode (`sitchco build`):**
- Compiles assets to `dist/assets/` with hashed filenames for cache busting
- Generates `manifest.json` mapping source paths to output files
- Optimizes and minifies all assets

### WordPress Integration

Your PHP code should implement an asset enqueuer that:

1. Checks for the `hot` file to detect dev mode
2. If present: Load assets from Vite dev server URL
3. If absent: Read `manifest.json` and load hashed assets from `dist/`
4. Use `wp_enqueue_script()` and `wp_enqueue_style()` to register assets

Example logic:
```php
$hot_file = get_template_directory() . '/dist/hot';
$is_dev_mode = file_exists($hot_file);

if ($is_dev_mode) {
    // Load from Vite dev server
    $base_url = 'http://localhost:5173';
} else {
    // Load from manifest.json
    $manifest = json_decode(file_get_contents($manifest_path), true);
    $asset_url = $manifest['assets/scripts/main.js']['file'];
}
```

### Framework Support

The tooling supports various JavaScript approaches through Vite:
- **Vanilla JS** - Simple scripts without frameworks
- **Alpine.js** - Lightweight interactivity
- **React/Vue** - Complex component-based UIs

Choose the right tool for each module's needs.

---

## Platform Versioning

All packages follow semantic versioning and are currently at **Platform v2**:
- Major version (2.x) represents the platform version
- Minor/patch versions increment independently per package
- Coordinated platform releases (like v2.1) align all packages to a common baseline

See individual package CHANGELOGs for detailed version history.

---

## Future Roadmap

**TypeScript Migration**: Gradually migrate core tooling packages to TypeScript for improved maintainability and type safety.

**Comprehensive Test Coverage**: Expand Vitest test suite with more unit and integration tests across all packages.

**Enhanced Documentation**: Continue improving documentation with more examples and use cases.

---

## Documentation

- [Release Process](docs/release-process.md) - How to version and publish packages
- [Husky Support](docs/husky-support.md) - Git hooks configuration and usage
- [TypeScript Guidelines](docs/typescript-guidelines.md) - TypeScript usage patterns

For package-specific documentation, see the README in each package directory.

---

## License

ISC
