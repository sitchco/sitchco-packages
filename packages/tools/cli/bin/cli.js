#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AdapterManager } from '../src/adapter-manager.js';
import { preCommitAction } from '../src/commands/pre-commit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

let moduleBuilderPromise;

const getModuleBuilder = () => {
    if (!moduleBuilderPromise) {
        moduleBuilderPromise = import('@sitchco/module-builder');
    }
    return moduleBuilderPromise;
};

let linterPromise;

const getLinter = () => {
    if (!linterPromise) {
        linterPromise = import('@sitchco/linter');
    }
    return linterPromise;
};

let formatterPromise;

const getFormatter = () => {
    if (!formatterPromise) {
        formatterPromise = import('@sitchco/formatter');
    }
    return formatterPromise;
};

async function runBuild() {
    try {
        const { cleanBuildArtifacts, findAssetTargets, runBuild: runModuleBuild } = await getModuleBuilder();
        await cleanBuildArtifacts();
        const targets = await findAssetTargets();
        await runModuleBuild(targets);
        return 0;
    } catch (error) {
        console.error(chalk.red('Build failed:'), error);
        return 1;
    }
}

async function runDev() {
    try {
        const { cleanBuildArtifacts, findAssetTargets, runDev: runModuleDev } = await getModuleBuilder();
        await cleanBuildArtifacts();
        const targets = await findAssetTargets();
        await runModuleDev(targets);
        return 0;
    } catch (error) {
        console.error(chalk.red('Dev server failed:'), error);
        return 1;
    }
}

async function runClean() {
    try {
        const { cleanBuildArtifacts } = await getModuleBuilder();
        await cleanBuildArtifacts();
        return 0;
    } catch (error) {
        console.error(chalk.red('Clean failed:'), error);
        return 1;
    }
}

program.name('sitchco').description('Unified CLI for Sitchco development tools').version(pkg.version);

program
    .command('lint')
    .description('Run ESLint on project files')
    .argument('[targets...]', 'files or directories to lint')
    .action(async (targets) => {
        try {
            const { runLint: lint } = await getLinter();
            process.exit(await lint(targets));
        } catch (error) {
            console.error(chalk.red('Lint failed:'), error);
            process.exit(1);
        }
    });

program
    .command('format')
    .description('Format project files')
    .argument('[files...]', 'files or directories to format')
    .action(async (files) => {
        try {
            const { runFormat: format } = await getFormatter();
            process.exit(await format(files));
        } catch (error) {
            console.error(chalk.red('Format failed:'), error);
            process.exit(1);
        }
    });

program
    .command('build')
    .description('Build all module/block assets for production')
    .action(async () => {
        process.exit(await runBuild());
    });

program
    .command('dev')
    .description('Watch module/block assets and rebuild on changes')
    .action(async () => {
        process.exit(await runDev());
    });

program
    .command('clean')
    .description('Clean all build artifacts')
    .action(async () => {
        process.exit(await runClean());
    });

program
    .command('prepare')
    .description('Install git hooks via Husky')
    .action(async () => {
        try {
            if (!existsSync('.git')) {
                process.exit(0);
            }

            const husky = await import('husky');
            const install = husky?.default ?? husky;
            const result = install('.husky');
            if (typeof result === 'string' && result.trim().length > 0) {
                console.log(result.trim());
            }

            // Create pre-commit hook that runs sitchco pre-commit
            const { copyFileSync, mkdirSync } = await import('fs');
            const { join } = await import('path');

            const huskyDir = '.husky';
            mkdirSync(huskyDir, { recursive: true });

            const preCommitPath = join(huskyDir, 'pre-commit');
            // Only create the pre-commit hook if it doesn't already exist
            if (!existsSync(preCommitPath)) {
                // Copy the pre-commit template from the CLI package
                const templatePath = join(__dirname, '../templates/pre-commit');
                copyFileSync(templatePath, preCommitPath);
                console.log(chalk.green('✓ Pre-commit hook installed successfully'));
            }

            process.exit(0);
        } catch (error) {
            console.error(chalk.red('Husky installation failed:'), error);
            process.exit(1);
        }
    });

program
    .command('pre-commit')
    .description('Run pre-commit checks (format and lint staged files)')
    .action(async () => {
        await preCommitAction(getFormatter, getLinter);
    });

program
    .command('run')
    .description('Execute a command with environment-agnostic context detection')
    .argument('<command>', 'command to execute')
    .argument('[args...]', 'additional arguments for the command')
    .option('-a, --adapter <name>', 'force specific adapter (ddev, local, etc.)')
    .option('-e, --enforce', 'make fallback failures exit non-zero')
    .option('-v, --verbose', 'show detailed execution information')
    .action(async (command, args, options) => {
        try {
            const adapterManager = new AdapterManager();

            // Load configuration from package.json if available
            await adapterManager.loadFromConfig();

            // Get current working directory
            const workingDir = process.cwd();

            await adapterManager.execute(workingDir, command, args, {
                adapter: options.adapter,
                enforce: options.enforce,
                verbose: options.verbose,
            });

            process.exit(0);
        } catch (error) {
            console.error(chalk.red('Command execution failed:'), error.message);
            process.exit(1);
        }
    });

program
    .command('adapters')
    .description('List available adapters and environment information')
    .option('-v, --verbose', 'show detailed information')
    .action(async (_options) => {
        try {
            const adapterManager = new AdapterManager();

            console.log(chalk.cyan('\n🔌 Available Adapters:'));
            const adapters = adapterManager.listAdapters();
            adapters.forEach((adapter) => {
                console.log(`  ${chalk.green(adapter.name)}: ${adapter.description} (priority: ${adapter.priority})`);
            });

            console.log(chalk.cyan('\n🌍 Environment Information:'));
            const env = adapterManager.getEnvironmentInfo();
            Object.entries(env).forEach(([key, value]) => {
                if (value !== undefined) {
                    console.log(`  ${key}: ${value}`);
                }
            });

            console.log(chalk.cyan('\n✅ Selected Adapter:'));
            const selectedAdapter = adapterManager.selectAdapter();
            console.log(`  ${chalk.green(selectedAdapter.name)}: ${selectedAdapter.description}`);
        } catch (error) {
            console.error(chalk.red('Failed to get adapter information:'), error.message);
            process.exit(1);
        }
    });

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('CLI error:'), err);
    process.exit(1);
});
