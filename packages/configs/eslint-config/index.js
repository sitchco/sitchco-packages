import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import eslintConfigPrettier from 'eslint-config-prettier';
import babelParser from '@babel/eslint-parser';
import presetEnv from '@babel/preset-env';
import presetReact from '@babel/preset-react';

export default [
    js.configs.recommended,
    eslintConfigPrettier,
    {
        ignores: ['node_modules/', 'dist/', '**/dist/', '.git/', 'vendor/', 'coverage/', 'logs/', '*.log'],
    },
    {
        files: ['**/*.{js,mjs,cjs,jsx}'],
        languageOptions: {
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                    presets: [presetEnv, presetReact],
                },
            },
        },
        plugins: {
            import: importPlugin,
            react: reactPlugin,
        },
        settings: {
            react: {
                pragma: 'createElement',
                version: 'detect',
            },
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
            'react/jsx-uses-react': 'error',
            'react/jsx-uses-vars': 'error',
        },
    },
    {
        files: ['packages/tools/**/*.{js,mjs}'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['modules/**/*.{js,mjs,jsx}'],
        languageOptions: {
            globals: {
                ...globals.browser,
                Sitchco: 'readonly',
                sitchco: 'readonly',
                jQuery: 'readonly',
                wp: 'readonly',
            },
        },
    },
    {
        files: ['*.js', '.*.js', 'scripts/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
];
