# @sitchco/cli

## 2.1.4

### Patch Changes

- 5ffb3ee: Bugfix: git relative paths

## 2.1.3

### Patch Changes

- Updated dependencies [81efa38]
  - @sitchco/module-builder@2.1.1

## 2.1.2

### Patch Changes

- Updated dependencies [3efbd30]
  - @sitchco/formatter@2.1.1
  - @sitchco/linter@2.1.9

## 2.1.1

### Patch Changes

- b3225ee: Include pre-commit template in the setup

## 2.1.0

### Minor Changes

- Platform v2 alignment: All packages now versioned at 2.x to represent the unified Sitchco Platform v2

## 2.0.22

### Patch Changes

- 51e264c: Simplified Husky installation logic by removing complex git root traversal

## 2.0.21

### Patch Changes

- @sitchco/formatter@1.0.10
- @sitchco/linter@2.1.8

## 2.0.20

### Patch Changes

- @sitchco/formatter@1.0.9
- @sitchco/linter@2.1.7

## 2.0.19

### Patch Changes

- - **Adapter System**: Added flexible adapter architecture for environment-specific command execution
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
  - @sitchco/formatter@1.0.8
  - @sitchco/module-builder@1.0.13
  - @sitchco/linter@2.1.6

## 2.0.18

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.12
  - @sitchco/formatter@1.0.7

## 2.0.17

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.11
  - @sitchco/formatter@1.0.6

## 2.0.16

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.10

## 2.0.15

### Patch Changes

- update shared dependencies
- Updated dependencies
  - @sitchco/module-builder@1.0.9
  - @sitchco/formatter@1.0.5
  - @sitchco/linter@2.1.5

## 2.0.14

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.8

## 2.0.13

### Patch Changes

- b1cf024: Updated dependencies
- Updated dependencies
- Updated dependencies [f536c25]
  - @sitchco/module-builder@1.0.7

## 2.0.12

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.6

## 2.0.10

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.5
  - @sitchco/formatter@1.0.4
  - @sitchco/linter@2.1.4

## 2.0.9

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.4
  - @sitchco/formatter@1.0.3
  - @sitchco/linter@2.1.3

## 2.0.8

### Patch Changes

- @sitchco/formatter@1.0.2
- @sitchco/linter@2.1.2
- @sitchco/module-builder@1.0.3

## 2.0.7

### Patch Changes

- Remove unneeded cli tooling

## 2.0.6

### Patch Changes

- Fix local dev scripts

## 2.0.5

### Patch Changes

- Add global link/unlink tools for local dev

## 2.0.4

### Patch Changes

- Updated dependencies
  - @sitchco/module-builder@1.0.2

## 2.0.1

### Patch Changes

- Refactored into @sitchco/sitchco-packages
- Updated dependencies
  - @sitchco/formatter@1.0.1
  - @sitchco/linter@2.1.1
  - @sitchco/module-builder@1.0.1

## 2.0.0

### Major Changes

- Test summary

### Patch Changes

- Updated dependencies
  - @sitchco/linter@2.1.0

## 1.0.1

### Patch Changes

- Updated dependencies [5c8a328]
- Updated dependencies [cfbae89]
  - @sitchco/linter@2.0.0
