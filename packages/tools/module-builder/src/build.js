import { build as viteBuild } from 'vite';
import chalk from 'chalk';
import { generateViteConfig } from './config.js';

export async function runBuild(target, isWatchMode) {
    if (!target?.viteInput?.length) {
        console.log(chalk.yellow(`No targets found. Nothing to build.`));
        return;
    }

    console.log(
        chalk.cyan(
            `\n🚀 Starting ${isWatchMode ? 'watch' : 'build'} with ${Object.keys(target.viteInput).length} entry points...`
        )
    );

    const viteConfig = await generateViteConfig(target, isWatchMode);
    await viteBuild(viteConfig);
}
