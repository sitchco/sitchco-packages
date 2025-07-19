#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { runLint } from '@sitchco/linter';
import { runFormat } from '@sitchco/formatter';
import {
    cleanBuildArtifacts,
    findAssetTargets,
    runBuild as runModuleBuild,
    runDev as runModuleDev,
} from '@sitchco/module-builder';

async function runBuild() {
    try {
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
        console.log(chalk.cyan('Preparing development server...'));
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
        await cleanBuildArtifacts();
        console.log(chalk.green('Build artifacts cleaned successfully.'));
        return 0;
    } catch (error) {
        console.error(chalk.red('Clean failed:'), error);
        return 1;
    }
}

program.name('sitchco').description('Unified CLI for Sitchco development tools').version('1.0.0');

program
    .command('lint')
    .description('Run ESLint on project files')
    .argument('[targets...]', 'files or directories to lint')
    .action(async (targets) => {
        process.exit(await runLint(targets));
    });

program
    .command('format')
    .description('Format project files')
    .argument('[files...]', 'files or directories to format')
    .action(async (files) => {
        process.exit(await runFormat(files));
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

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('CLI error:'), err);
    process.exit(1);
});
