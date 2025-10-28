import chalk from 'chalk';

/**
 * Pre-commit hook that:
 * 1. Auto-unstages lock files on feature branches
 * 2. Auto-unstages package.json files with link: overrides (and related lock files)
 * 3. Formats remaining staged files
 * 4. Runs linter
 */
export async function preCommitAction(getFormatter, getLinter) {
    try {
        const { spawnSync } = await import('child_process');
        const { readFileSync } = await import('fs');
        const { dirname } = await import('path');

        // Check if there are staged files
        const gitDiff = spawnSync('git', ['diff', '--cached', '--quiet', '--diff-filter=ACMR'], {
            stdio: 'ignore',
        });
        if (gitDiff.status === 0) {
            process.exit(0);
        }

        // Get current branch name
        const branchResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            encoding: 'utf8',
        });
        const currentBranch = branchResult.stdout?.trim() || '';
        const isFeatureBranch = currentBranch.startsWith('feature');

        // Get staged files (relative to current directory)
        const stagedFilesResult = spawnSync(
            'git',
            ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '--relative', '-z'],
            {
                encoding: 'utf8',
            }
        );

        let stagedFiles = stagedFilesResult.stdout?.trim().split('\0').filter(Boolean) || [];
        if (stagedFiles.length === 0) {
            process.exit(0);
        }

        // Track files to unstage with categorized reasons
        const lockFilesOnFeature = [];
        const packageFilesWithLinks = [];
        const relatedLockFiles = [];

        // Check for files to auto-unstage
        for (const file of stagedFiles) {
            const fileName = file.split('/').pop();
            // 1. Lock files on feature branches
            if (isFeatureBranch && (fileName === 'pnpm-lock.yaml' || fileName === 'composer.lock')) {
                lockFilesOnFeature.push(file);
                continue;
            }
            // 2. package.json files with link: overrides
            if (fileName === 'package.json') {
                try {
                    const content = readFileSync(file, 'utf8');
                    if (content.includes('link:')) {
                        packageFilesWithLinks.push(file);

                        // Also unstage related lock files in the same directory
                        const fileDir = dirname(file);
                        const lockInSameDir = stagedFiles.filter((f) => {
                            const fName = f.split('/').pop();
                            const fDir = dirname(f);
                            return (
                                fDir === fileDir &&
                                (fName === 'pnpm-lock.yaml' || fName === 'composer.lock') &&
                                !lockFilesOnFeature.includes(f)
                            );
                        });
                        relatedLockFiles.push(...lockInSameDir);
                    }
                } catch {
                    // If we can't read the file, skip it
                }
            }
        }

        // Combine all files to unstage
        const filesToUnstage = [...lockFilesOnFeature, ...packageFilesWithLinks, ...relatedLockFiles];
        // Unstage files if needed
        if (filesToUnstage.length > 0) {
            filesToUnstage.forEach((file) => {
                spawnSync('git', ['reset', 'HEAD', file], { stdio: 'ignore' });
            });

            // Show informative warning
            console.log(chalk.yellow('\n⚠️  Auto-unstaged files:\n'));

            if (lockFilesOnFeature.length > 0) {
                console.log(chalk.dim(`Lock files (feature branch '${currentBranch}'):`));
                lockFilesOnFeature.forEach((file) => {
                    console.log(chalk.dim(`  • ${file}`));
                });

                console.log();
            }
            if (packageFilesWithLinks.length > 0) {
                console.log(chalk.dim('Package files with link: overrides:'));
                packageFilesWithLinks.forEach((file) => {
                    console.log(chalk.dim(`  • ${file}`));
                });

                if (relatedLockFiles.length > 0) {
                    relatedLockFiles.forEach((file) => {
                        console.log(chalk.dim(`  • ${file}`));
                    });
                }

                console.log();
            }

            console.log(chalk.cyan('💡 Continuing with remaining staged files...\n'));

            // Update staged files list to exclude unstaged files
            stagedFiles = stagedFiles.filter((file) => !filesToUnstage.includes(file));

            // Exit early if no files remain
            if (stagedFiles.length === 0) {
                console.log(chalk.yellow('No files remaining to commit.'));
                process.exit(0);
            }
        }
        // Format remaining staged files
        if (stagedFiles.length > 0) {
            const { runFormat: format } = await getFormatter();
            await format(stagedFiles);

            // Re-stage the formatted files
            stagedFiles.forEach((file) => {
                spawnSync('git', ['add', file], { stdio: 'ignore' });
            });
        }

        // Run linter
        const { runLint: lint } = await getLinter();
        const lintResult = await lint();
        process.exit(lintResult);
    } catch (error) {
        console.error(chalk.red('Pre-commit checks failed:'), error);
        process.exit(1);
    }
}
