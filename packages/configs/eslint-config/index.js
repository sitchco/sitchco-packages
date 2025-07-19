import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';
import babelParser from '@babel/eslint-parser';

export default [
    js.configs.recommended,
    eslintConfigPrettier,
    {
        ignores: ['node_modules/', 'dist/', '**/dist/', '.git/', 'vendor/', 'coverage/', 'logs/', '*.log'],
    },
    {
        files: ['**/*.{js,mjs,cjs}'],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    presets: ['@babel/preset-env'],
                },
            },
        },
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/no-extraneous-dependencies': 'off',
            'no-prototype-builtins': 'off',
            curly: ['error', 'all'],
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['packages/build-tools/**/*.{js,mjs}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['modules/**/*.{js,mjs}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                Sitchco: 'readonly',
                jQuery: 'readonly',
            },
        },
    },
    {
        files: ['*.js', '.*.js'],
        languageOptions: {
            globals: {
                ...globals.commonjs,
            },
        },
    },
];
