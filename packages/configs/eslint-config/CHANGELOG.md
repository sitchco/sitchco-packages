# @sitchco/eslint-config

## 2.1.0

### Major Changes

- Platform v2 alignment: All packages now versioned at 2.x to represent the unified Sitchco Platform v2

## 1.0.6

### Patch Changes

- Ensure dependencies get hoisted

## 1.0.5

### Patch Changes

-   - Added `@babel/preset-react` dependency to enable React JSX parsing
    - Updated ESLint configuration to include React preset in Babel options
    - Added new global variables for linter:
        - `sitchco` (readonly)
        - `wp` (readonly)
    - Root package.json: Added `@babel/preset-react` as dev dependency
    - ESLint config package: Added `@babel/preset-react` as dependency

    This update enables proper linting of React components and JSX syntax within the Sitchco packages ecosystem.

## 1.0.4

### Patch Changes

- Updated ESLint paths from `build-tools` to `tools` package structure

## 1.0.3

### Patch Changes

- update shared dependencies

## 1.0.2

### Patch Changes

- Support JSX file handling across tools and configurations

## 1.0.1

### Patch Changes

- Refactored into @sitchco/sitchco-packages
