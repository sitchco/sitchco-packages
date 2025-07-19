# @sitchco/eslint-config

Shared ESLint configuration for Sitchco projects.

## Installation

```bash
npm install @sitchco/eslint-config
# or
yarn add @sitchco/eslint-config
# or
pnpm add @sitchco/eslint-config
```

## Usage

### In ESLint Config File

Create an `eslint.config.mjs` file in your project root:

```javascript
import sitchcoConfig from '@sitchco/eslint-config';

export default [
  ...sitchcoConfig,
  // Your custom rules here
];
```

### With Legacy Config Format

If you're using the legacy configuration format:

```javascript
module.exports = {
  extends: ['@sitchco/eslint-config'],
  // Your custom rules here
};
```

## Features

This configuration includes:

- Modern JavaScript best practices
- Compatibility with Prettier
- Import sorting and organization

## Dependencies

This package includes:

- `@babel/eslint-parser`: For parsing modern JavaScript
- `@babel/preset-env`: For transpiling modern JavaScript
- `@eslint/js`: Core ESLint rules
- `eslint-config-prettier`: Disables ESLint rules that conflict with Prettier
- `eslint-plugin-import`: Rules for import statements

## License

ISC
