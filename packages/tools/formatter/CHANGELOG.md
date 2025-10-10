# @sitchco/formatter

## 1.0.8

### Patch Changes

-   - **Adapter System**: Added flexible adapter architecture for environment-specific command execution
    - **DDEV Support**: Native DDEV environment detection and command execution
    - **Local Fallback**: Automatic fallback to local execution when primary adapters fail
    - **Environment Detection**: Smart detection of development environments (DDEV, local, etc.)
    - **`sitchco prepare`**: Install and configure git hooks via Husky
    - **`sitchco pre-commit`**: Automated formatting and linting of staged files
    - **`sitchco run <command>`**: Environment-agnostic command execution with adapter selection
    - **`sitchco adapters`**: List available adapters and environment information
    - **Lazy Loading**: Improved performance with on-demand module loading
    - **Smart Pre-commit**: Automatic formatting before commits with file re-staging
    - **Flexible Execution**: Supports both local `sitchco` and `npx @sitchco/cli` execution
    - **Better Error Handling**: Graceful fallbacks and informative error messages
    - Updated ESLint paths from `build-tools` to `tools` package structure
    - Improved workspace configuration for better package management
    - Enhanced formatter and module-builder configurations
    - Added Husky integration for git hook management
    - Updated lockfile with latest dependency versions

    This release significantly improves the development experience by providing environment-aware tooling that works seamlessly across different development setups while maintaining backward compatibility.

- Updated dependencies
    - @sitchco/eslint-config@1.0.4

## 1.0.7

### Patch Changes

- Refine SVG and PHP formatting
- Updated dependencies
    - @sitchco/prettier-config@1.0.4

## 1.0.6

### Patch Changes

- Updated dependencies
    - @sitchco/prettier-config@1.0.3

## 1.0.5

### Patch Changes

- update shared dependencies
- Updated dependencies
    - @sitchco/eslint-config@1.0.3
    - @sitchco/prettier-config@1.0.2
    - @sitchco/project-scanner@1.0.5

## 1.0.4

### Patch Changes

- Updated dependencies
    - @sitchco/project-scanner@1.0.4

## 1.0.3

### Patch Changes

- Support JSX file handling across tools and configurations
- Updated dependencies
    - @sitchco/eslint-config@1.0.2
    - @sitchco/project-scanner@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies
    - @sitchco/project-scanner@1.0.2

## 1.0.1

### Patch Changes

- Refactored into @sitchco/sitchco-packages
- Updated dependencies
    - @sitchco/eslint-config@1.0.1
    - @sitchco/prettier-config@1.0.1
    - @sitchco/project-scanner@1.0.1
