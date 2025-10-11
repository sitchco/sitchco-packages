/**
 * Sitchco Prettier Configuration
 *
 * Shareable Prettier config for all sitchco projects.
 * This ensures consistent code formatting across the team.
 *
 * Usage in projects:
 * 1. Add "prettier": "@sitchco/prettier-config" to package.json
 * 2. Or extend in .prettierrc.js:
 *    export { default } from '@sitchco/prettier-config';
 */
export default {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    endOfLine: 'auto',

    // PHP-specific settings
    phpVersion: '8.2',
    trailingCommaPHP: true,
};
