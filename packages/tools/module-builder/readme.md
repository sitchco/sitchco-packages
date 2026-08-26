# @sitchco/module-builder

A programmatic build tool that dynamically configures and runs Vite to compile assets for the Sitchco WordPress platform.

## Overview

The `@sitchco/module-builder` is the core engine for asset compilation in the `sitchco-core` project. It provides a programmatic API to discover modules and their assets, generate a tailored Vite configuration on the fly, and run development or production builds.

Its workflow is designed around simplicity and convention:

1.  **Discover:** It scans the project to find all feature modules and their asset entry points.
2.  **Configure:** It generates a Vite configuration in memory tailored to the discovered assets.
3.  **Build:** It uses the Vite API to either compile assets for production or start a development server with Hot Module Replacement (HMR).

## How It Works

### Module & Entry Point Discovery

This package uses `@sitchco/project-scanner` to find assets based on a simple directory convention:

* **Module Definition:** Any direct subdirectory inside `sitchco-core/modules/` is automatically treated as a module.
* **Entry Point Scanning:** Within each module directory, it searches for entry point files (`.js`, `.mjs`, `.jsx`, `.scss`, `.css`) in the following standard locations:
    * The module's root directory
    * `assets/scripts/`
    * `assets/styles/`
    * The root of each block in the `blocks/` directory
    * The `assets/` directory of each block

### SVG Sprite

Every SVG in a module's `assets/images/svg-sprite/` directory is compiled into a single `dist/assets/images/sprite.svg`, as a `<symbol>` whose id is the source filename.

Only the `icon-` prefixed ones are *icons*. Those are written (prefix stripped) to `dist/assets/images/sprite-icons.json`, which is what the PHP side offers in the icon picker and renders with `renderIcon()` — a call that resolves back to `#icon-{name}`, so an unprefixed symbol could never answer it.

Anything without the prefix is still in the sprite and is referenced directly:

```html
<svg><use href="#half-circle"></use></svg>
```

That is the supported way to ship a decorative shape without it turning up as an icon choice.

### WordPress Integration

Seamless integration with the WordPress backend is achieved using `laravel-vite-plugin`. This powerful plugin handles the complexities of asset mapping:

* In **production** (`runBuild`), it generates a `dist/manifest.json` file. The PHP backend uses this manifest to look up the final, hashed filenames for enqueuing.
* In **development** (`runDev`), it creates a `.vite.hot` file. The existence of this file tells the PHP backend to load assets directly from the Vite development server, enabling HMR.

## Programmatic Usage

This package provides an API that is primarily consumed by the `@sitchco/cli` tool. The intended workflow is to first discover targets and then pass them to a build function.

```javascript
import {
    findAssetTargets,
    runBuild,
    runDev,
    cleanBuildArtifacts,
} from '@sitchco/module-builder';

async function buildMyProject() {
    // First, clean any previous artifacts
    await cleanBuildArtifacts();

    // 1. Discover all modules and their asset entry points
    const targets = await findAssetTargets();

    // 2. Run a production build using the discovered targets
    await runBuild(targets);
}

async function developMyProject() {
    await cleanBuildArtifacts();
    const targets = await findAssetTargets();

    // Or, start the development server with HMR
    await runDev(targets);
}
```

## API Reference

#### `findAssetTargets(): Promise<object>`

Scans the project using directory conventions and returns a "target object." This object contains all the paths and the array of entry points (`viteInput`) required to configure Vite.

#### `runBuild(targets: object): Promise<void>`

Executes a production Vite build using the provided `targets` object.

#### `runDev(targets: object): Promise<void>`

Starts the Vite development server with HMR enabled, using the provided `targets` object.

#### `cleanBuildArtifacts(): Promise<void>`

Removes the previously generated build artifacts (i.e., the `dist/` directory) from the project.
