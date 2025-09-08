import { promises as fs } from 'fs';
import { resolve, basename } from 'path';
import svgstore from 'svgstore';
import { glob } from 'glob';
import chalk from 'chalk';
import {IMAGES_DIST_SUBFOLDER, SVG_DIST_SUBFOLDER} from "@sitchco/project-scanner";

export default async function svgstoreSprite() {
    const absInput = resolve(process.cwd(), `dist/${SVG_DIST_SUBFOLDER}`);
    const absOutput = resolve(process.cwd(), `dist/${IMAGES_DIST_SUBFOLDER}/sprite.svg`);

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
        files.map(file =>
            fs.readFile(file, 'utf8').then(svg => ({
                id: basename(file, '.svg'),
                svg
            }))
        )
    );

    svgs.forEach(({ id, svg }) => sprites.add(id, svg));


    await fs.writeFile(absOutput, sprites.toString());
    console.log(chalk.green(`✅ SVG sprite generated at ${absOutput}`));
    return absOutput
}
