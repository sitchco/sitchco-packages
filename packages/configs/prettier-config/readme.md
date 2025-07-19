# @sitchco/prettier-config

Shared Prettier configuration for Sitchco projects.

## Installation

```bash
npm install @sitchco/prettier-config
# or
yarn add @sitchco/prettier-config
# or
pnpm add @sitchco/prettier-config
```

## Usage

### In package.json

The simplest way to use this configuration is to add it to your `package.json`:

```json
{
  "prettier": "@sitchco/prettier-config"
}
```

### In .prettierrc.js

For more flexibility, create a `.prettierrc.js` file:

```javascript
module.exports = {
  ...require('@sitchco/prettier-config'),
  // Your custom rules here
};
```

## Features

This configuration includes:

- Single quotes
- Tab width of 4 spaces
- No semicolons
- Trailing commas where valid in ES5
- Arrow function parentheses only when needed
- Consistent line endings

## Dependencies

This package is a standalone JSON configuration and has no dependencies.

## License

ISC
