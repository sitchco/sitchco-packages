import { existsSync } from 'fs';
import { join, relative } from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';

let huskyPromise;

const getHusky = () => {
    if (!huskyPromise) {
        huskyPromise = import('husky');
    }
    return huskyPromise;
};

function getGitRoot() {
    try {
        const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (result.status === 0 && result.stdout) {
            return result.stdout.trim();
        }
    } catch {
        // Ignore resolution errors; we'll fall back to default Husky behavior.
    }
    return null;
}

function determineHuskyInstallTarget() {
    const gitRoot = getGitRoot();
    if (!gitRoot) {
        return {
            targetDir: '.husky',
            gitRoot: null,
            isRelative: false,
        };
    }

    const hooksDir = join(process.cwd(), '.husky');
    const relativeHooksPath = relative(gitRoot, hooksDir);
    if (!relativeHooksPath || relativeHooksPath.startsWith('..')) {
        return {
            targetDir: '.husky',
            gitRoot,
            isRelative: false,
        };
    }
    return {
        targetDir: relativeHooksPath.replace(/\\/g, '/'),
        gitRoot,
        isRelative: true,
    };
}

export async function installHuskyHooks() {
    const originalCwd = process.cwd();
    let exitCode = 0;
    let successMessage = null;
    let warningMessage = null;
    let gitRoot = null;

    try {
        const huskyModule = await getHusky();
        const install = huskyModule?.default ?? huskyModule;
        const { targetDir, gitRoot: resolvedRoot, isRelative } = determineHuskyInstallTarget();
        gitRoot = resolvedRoot;

        if (!gitRoot) {
            warningMessage =
                'Git repository not detected; skipping Husky installation (run this command from the host repo root).';
        } else if (!existsSync(join(gitRoot, '.git'))) {
            warningMessage =
                'Git metadata (.git) is not available from this location; skipping Husky installation (run on your host machine).';
        } else {
            if (isRelative && targetDir !== '.husky') {
                console.log(chalk.cyan(`Configuring Husky hooks at ${targetDir}`));
            }

            process.chdir(gitRoot);
            const result = install(targetDir);
            if (typeof result === 'string' && result.trim().length > 0) {
                if (result.includes(".git can't be found")) {
                    warningMessage =
                        'Husky could not locate the .git directory; skip installing hooks (try running on the host).';
                } else if (result.includes('git command not found')) {
                    warningMessage = 'Husky could not run git; ensure git is available in your PATH.';
                } else if (result.includes('HUSKY=0')) {
                    warningMessage = 'Husky installation skipped because HUSKY=0.';
                } else {
                    console.log(result.trim());
                }
            }
            if (!warningMessage) {
                successMessage = 'Husky git hooks installed.';
            }
        }
    } catch (error) {
        console.error(chalk.red('Prepare failed:'), error);
        exitCode = 1;
    } finally {
        if (gitRoot && process.cwd() !== originalCwd) {
            process.chdir(originalCwd);
        }
        if (successMessage) {
            console.log(chalk.green(successMessage));
        } else if (warningMessage) {
            console.warn(chalk.yellow(warningMessage));
        }

        process.exit(exitCode);
    }
}
