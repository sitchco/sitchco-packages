# Sitchco WordPress Platform Tooling

## 1. Vision & Goals

The **Sitchco WordPress Platform** provides a **modern, scalable** WordPress foundation for multiple client sites and
distribution scenarios. The core objectives remain:

- A **Must-Use (MU) plugin** (`sitchco-core`) acting as “platform core” logic.
- A **parent/child theme** structure ensuring consistent front-end and inheritance-based workflows.
- A **modular approach** segmenting features (blocks, components, UI patterns) into “modules,” which can be reused
  across the MU plugin, themes, or standalone plugins, identified by a `.sitchco-module` marker file.
- A **tooling suite** that unifies linting, formatting, testing, and building for JavaScript, Sass, SVG, and other
  assets.

A key consideration is ensuring **flexibility** for different build contexts:

- **Composer `prefer-dist`** mode, where packages include only compiled assets (and no source markers).
- **Composer `prefer-src`** or direct monorepo development, where all source files are editable, and local watchers can
  be run in each package/theme.

We also acknowledge the possibility of **lightweight frontend frameworks** like Alpine.js for minimal interactivity, or
React/Vue for more complex scenarios, but we don’t intend to force heavy frameworks on simple components.

---

## 2. Technology Stack

The platform’s tooling leverages:

- **Node.js (>=18)** and **pnpm** (with workspace support for managing internal packages).
- **Vite** for fast JS/CSS bundling and development server.
- **`laravel-vite-plugin`**: Integrates Vite with PHP environments, handling manifest generation, hot module
  replacement (HMR) detection via a `hot` file, and asset URL generation.
- **`sass-embedded`**: For compiling Sass/SCSS stylesheets.
- **ESLint** (with `@sitchco/eslint-config`) for JavaScript linting.
- **Prettier** (with `@sitchco/prettier-config`) for code formatting.
- **Terser**: Used within `dev-scripts` for JavaScript formatting/optimization.
- **SVGO**: Used within `dev-scripts` for SVG optimization/formatting.
- **Vitest**: For unit and integration testing of tooling packages and JavaScript components.
- **Changesets** (optional): For managing versioning and changelogs within the monorepo.

---

## 3. Monorepo & Package Structure

The shared build tooling resides within the **sitchco-core** MU plugin in a dedicated `packages/` folder. This
centralizes build logic while allowing dependent projects (like child themes) to remain editable. In Composer *
*`prefer-dist`** mode, the MU plugin, plugins, and parent theme are installed as dependencies without marker files. The
child theme(s) in the main project repository retain their `.sitchco-module` marker files, enabling local development
builds.

```
wp-content/
├── mu-plugins/
│   └── sitchco-core/
│       ├── packages/
│       │   ├── build-tools/
│       │   │   ├── cli/                 # Provides the unified `sitchco` command
│       │   │   ├── linter/              # Programmatic ESLint runner
│       │   │   ├── formatter/           # Programmatic code formatter
│       │   │   ├── module-builder/      # Core Vite build engine
│       │   │   ├── project-scanner/     # Discovers modules via directory convention
│       │   │   ├── eslint-config/       # Shared ESLint rules
│       │   │   └── prettier-config/     # Shared Prettier configuration
│       │   └── shared/                  # (Optional) Shared UI libraries, tokens, etc.
│       └── ... (other sitchco-core files)
├── themes/
│   ├── sitchco-parent-theme/            # Composer dependency (no marker files in dist mode)
│   └── sitchco-child-theme/             # Main project repo (contains marker files)
└── plugins/
└── (Other plugins as Composer dependencies)
```

This structure ensures that while core platform elements are managed as dependencies, the primary development target (
e.g., the child theme) uses the tooling via its marker file for local asset processing.

---

## 4. Core Tooling Packages

The key tooling packages under `sitchco-core/packages/build-tools/` provide:

* **`@sitchco/project-scanner`**: Responsible for discovering modules by scanning for subdirectories within the
  `modules/` folder. It identifies entry points (JS/SCSS), finds the WordPress web root, and provides file-finding
  utilities to other tools.

* **`@sitchco/module-builder`**: The core build engine. It uses `@sitchco/project-scanner` to find assets and then
  orchestrates `vite` (using `laravel-vite-plugin`) to compile them into a root `dist/` folder for development or
  production.

* **`@sitchco/cli`**: Provides the single `sitchco` command as a unified developer entry point. It acts as a wrapper,
  delegating tasks to the other tooling packages (e.g., `sitchco build` runs the `module-builder`).

* **`@sitchco/linter`**: A programmatic wrapper for ESLint that ensures the project's root configuration is always used
  for consistent results.

* **`@sitchco/formatter`**: A programmatic formatter that uses a processor-based system to format different file types (
  Prettier for JS/CSS, SVGO for SVG, etc.).

* **`@sitchco/eslint-config` & `@sitchco/prettier-config`**: These shared configurations standardize code style and
  formatting rules across all projects, ensuring consistency.

Together, these packages provide a consistent developer experience, supporting flexible builds across different project
setups and distribution modes.

---

## 5. Architectural Principles & Developer Workflow

1. **Project-Level Builds:**
    - Build commands (`module-builder build|dev`) are typically run from the **project root** (e.g., the directory
      containing the child theme or the entire monorepo).
    - The tooling scans for `.sitchco-module` markers starting from the current working directory.
    - All discovered assets are compiled into a single `dist/` folder at the project root, along with a `manifest.json`
      and a `hot` file (in dev mode).

2. **Flexible Execution Context:**
    - **Monorepo / Full Source:** Devs run `pnpm dev` or `pnpm build` from the project root containing multiple source
      packages (MU plugin, themes, etc.) marked with `.sitchco-module`.
    - **Client Project / Partial Source:** A client working only on a child theme runs `pnpm dev` or `pnpm build` within
      their project folder (which contains the child theme with its `.sitchco-module` marker). The tooling builds only
      the assets found within that scope.

3. **Asset Structure & Manifest:**
    - Vite (via `laravel-vite-plugin`) manages asset compilation, placing outputs typically in `dist/assets/...` with
      hashed filenames for cache busting.
    - A single `manifest.json` is generated in the `dist/` folder, mapping source entry points to their hashed output
      files.
    - In development (`dev` mode), assets are served by Vite's dev server (`http://localhost:5173/...` by default), and
      a `hot` file is created in the `dist/` directory.

4. **Enqueueing in WordPress:**
    - A centralized PHP helper class (e.g., `Sitchco\Core\AssetEnqueuer`) is expected to handle asset registration.
    - This helper should:
        - Check for the existence of the `hot` file in the `dist/` directory to determine if the Vite dev server is
          active.
        - If the `hot` file exists, load assets directly from the Vite dev server URL.
        - If the `hot` file does *not* exist, read the `dist/manifest.json`.
        - Use the manifest to map logical asset paths (e.g., `assets/scripts/main.js`) to their final, hashed URLs in
          the `dist/` folder.
        - Enqueue scripts and styles using `wp_enqueue_script` / `wp_enqueue_style` with the correct URLs and
          dependencies.

5. **Minimal or Advanced JS Frameworks:**
    - The tooling supports Vanilla JS, Alpine.js, or more complex frameworks like React/Vue on a per-entry-point basis,
      as Vite handles the bundling.

6. **Distribution & Client Handoff:**
    - **Internal Devs:** Work in source mode (`prefer-src` or monorepo), using `pnpm dev`.
    - **Clients/Agencies:** Receive packages (themes/plugins) typically via Composer in `prefer-dist` mode. Only the
      necessary PHP files and the compiled `dist/` folder (with `manifest.json`) are included in distributed packages,
      while the main project repo (e.g., child theme) retains source files and the `.sitchco-module` marker for local
      development.

---

### **6. Future Goals & Roadmap**

While the current tooling provides a robust and stable foundation for development, we are committed to continuous
improvement. The following are key areas targeted for future enhancement:

* **TypeScript Migration**
  Gradually migrate the core JavaScript-based tooling packages (`@sitchco/project-scanner`, `@sitchco/module-builder`,
  etc.) to TypeScript. This will improve long-term maintainability, enhance the developer experience with type safety,
  and increase overall code quality.

* **Comprehensive Test Coverage**
  Expand the test suite using Vitest for all core tooling packages. This includes adding more unit tests for individual
  functions and integration tests to verify the end-to-end workflows (e.g., scanning, building, linting). A strong test
  suite will ensure reliability and prevent regressions.

---

### **7. Conclusion**

The **Sitchco WordPress Platform Tooling** provides a modern, performant, and consistent development workflow built on
Node.js, Vite, and pnpm workspaces. Its architecture is composed of specialized, internal NPM packages that handle
specific tasks like scanning, building, linting, and formatting.

At its core, the system uses a **convention-based approach** to automatically discover modules (any subdirectory of
`/modules`) and their assets, which are then processed by `@sitchco/module-builder`. This design, combined with seamless
PHP integration via `laravel-vite-plugin`, results in a powerful and unified developer experience with a simple
command-line interface (`sitchco`). It balances flexibility and maintainability, supporting everything from local
development with HMR to optimized production builds.
