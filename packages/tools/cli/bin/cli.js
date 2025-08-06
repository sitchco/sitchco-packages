#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
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

function findPackages(dir, depth = 0) {
    const packages = [];
    if (!fs.existsSync(dir)) {
        return packages;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (file === 'node_modules') {
            continue;
        }

        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                packages.push(fullPath);
            }

            packages.push(...findPackages(fullPath, depth + 1));
        }
    }
    return packages;
}

async function runLink(branch = 'main', packagesDir = './packages') {
    try {
        console.log(chalk.cyan(`» Removing existing packages at ${packagesDir}...`));
        fs.rmSync(packagesDir, {
            recursive: true,
            force: true,
        });

        console.log(chalk.cyan(`» Cloning branch '${branch}' into ${packagesDir}...`));
        execSync(`git clone -b ${branch} git@github.com:sitchco/sitchco-packages.git ${packagesDir}`, {
            stdio: 'inherit',
        });

        console.log(chalk.cyan('» Installing packages dependencies...'));
        execSync('pnpm install', {
            cwd: packagesDir,
            stdio: 'inherit',
        });

        const packagePaths = findPackages(packagesDir);
        if (!packagePaths.length) {
            console.log(chalk.yellow('No packages found to link.'));
            return;
        }

        console.log(chalk.cyan('» Linking packages globally...'));

        for (const pkgPath of packagePaths) {
            console.log(chalk.cyan(`  - Linking ${pkgPath}...`));
            execSync('pnpm link --global', {
                cwd: pkgPath,
                stdio: 'inherit',
            });
        }

        console.log(chalk.cyan('» Installing project dependencies...'));
        execSync('pnpm install', { stdio: 'inherit' });

        console.log(chalk.green('✔ All packages linked and installed.'));
        process.exit(0);
    } catch (err) {
        console.error(chalk.red('✖ Link failed:'), err);
        process.exit(1);
    }
}

async function runUnlink(packagesDir = './packages') {
    try {
        const packagePaths = findPackages(packagesDir);
        if (!packagePaths.length) {
            console.log(chalk.yellow('No packages found to unlink.'));
            return;
        }

        console.log(chalk.cyan('» Unlinking global packages...'));

        for (const pkgPath of packagePaths) {
            const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8'));
            const name = pkgJson.name;
            console.log(chalk.cyan(`  - Removing global link for ${name}…`));
            execSync(`pnpm uninstall --global ${name}`, {
                cwd: pkgPath,
                stdio: 'inherit',
            });
        }

        console.log(chalk.green('✔ All packages unlinked.'));

        console.log(chalk.cyan(`» Removing packages directory ${packagesDir}...`));
        fs.rmSync(packagesDir, {
            recursive: true,
            force: true,
        });

        console.log(chalk.green('✔ Unlinked and cleaned up.'));
        process.exit(0);
    } catch (err) {
        console.error(chalk.red('✖ Unlink failed:'), err);
        process.exit(1);
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

program
    .command('link')
    .description('Clone, install, and globally link the sitchco packages')
    .option('-b, --branch <branch>', 'Git branch to clone', 'main')
    .option('-p, --path <path>', 'Path to clone packages into', './packages')
    .action(({ branch, path: packagesDir }) => runLink(branch, packagesDir));

program
    .command('unlink')
    .description('Unlink global sitchco packages and remove local clone')
    .option('-p, --path <path>', 'Path to packages directory', './packages')
    .action(({ path: packagesDir }) => runUnlink(packagesDir));

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('CLI error:'), err);
    process.exit(1);
});
