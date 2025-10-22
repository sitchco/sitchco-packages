import { promises as fs } from 'fs';
import { resolve, basename } from 'path';
import svgstore from 'svgstore';
import { glob } from 'glob';
import chalk from 'chalk';
import { IMAGES_DIST_SUBFOLDER, SVG_DIST_SUBFOLDER } from '@sitchco/project-scanner';

export default async function svgstoreSprite() {
    const absInput = resolve(process.cwd(), `dist/${SVG_DIST_SUBFOLDER}`);
    const absSpriteOutput = resolve(process.cwd(), `dist/${IMAGES_DIST_SUBFOLDER}/sprite.svg`);
    const absIconsOutput = resolve(process.cwd(), `dist/${IMAGES_DIST_SUBFOLDER}/sprite-icons.json`);

    try {
        await fs.access(absInput);
    } catch {
        console.log(chalk.yellow(`ℹ️  Skipping SVG sprite generation for ${process.cwd()}`));
        return;
    }

    const files = await glob(`${absInput}/**/*.svg`);
    const sprites = svgstore();

    // Read all SVGs in parallel
    const svgs = await Promise.all(
        files.map((file) =>
            fs.readFile(file, 'utf8').then((svg) => ({
                id: basename(file, '.svg'),
                svg,
            }))
        )
    );

    svgs.forEach(({ id, svg }) => sprites.add(id, svg));

    const icons = [];
    sprites.element('svg symbol').each((i, element) => icons.push(element.attribs.id.replace('icon-', '')));

    await fs.writeFile(absIconsOutput, JSON.stringify(icons.sort(), null, 2));

    await fs.writeFile(
        absSpriteOutput,
        sprites.toString({
            inline: true,
            svgAttrs: {
                width: 0,
                height: 0,
                style: 'position:absolute',
                'aria-hidden': 'true',
            },
        })
    );

    console.log(chalk.green(`✅ SVG sprite generated at ${absSpriteOutput}`));
    return absSpriteOutput;
}
