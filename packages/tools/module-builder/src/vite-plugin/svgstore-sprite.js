import { promises as fs } from 'fs';
import { resolve, basename } from 'path';
import svgstore from 'svgstore';
import { glob } from 'glob';
import chalk from 'chalk';
import { IMAGES_DIST_SUBFOLDER, SVG_DIST_SUBFOLDER } from '@sitchco/project-scanner';

export const ICON_PREFIX = 'icon-';

/**
 * Reduce a list of sprite symbol ids to the icons among them, with the prefix stripped.
 *
 * A module's svg-sprite directory is not an icon directory. Everything in it goes into the
 * sprite, and this prefix is what separates the icons from shapes that are only ever
 * referenced directly with `<use href="#{id}">`. Only prefixed symbols can render as icons:
 * the PHP side asks the sprite for `#icon-{name}` and resolves a name's source file by
 * globbing `icon-{name}.svg`, so an unprefixed id in this list is an icon picker choice that
 * points at nothing. Leaving it out is what lets a module ship a shape without polluting the
 * picker — don't prefix it.
 *
 * Mirrored by SvgSprite::iconNames() in sitchco-core, which applies the same rule to the
 * source filenames when a vite dev server is running and this file's output is not in play.
 */
export function iconNames(symbolIds) {
    return symbolIds.filter((id) => id.startsWith(ICON_PREFIX)).map((id) => id.slice(ICON_PREFIX.length));
}

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

    // The sprite carries every symbol; the icon list is only the `icon-` prefixed ones.
    const symbolIds = [];
    sprites.element('svg symbol').each((i, element) => symbolIds.push(element.attribs.id));

    await fs.writeFile(absIconsOutput, JSON.stringify(iconNames(symbolIds).sort(), null, 2));

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
