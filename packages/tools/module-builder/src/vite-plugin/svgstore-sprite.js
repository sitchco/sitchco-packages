import { promises as fs } from 'fs';
import { resolve, join, basename } from 'path';
import svgstore from 'svgstore';
import {IMAGES_DIST_SUBFOLDER, SVG_DIST_SUBFOLDER} from "@sitchco/project-scanner";

export default function svgstoreSprite() {
    return {
        name: 'custom-svg-sprite',
        closeBundle: async () => {
            const absInput = resolve(process.cwd(), `dist/${SVG_DIST_SUBFOLDER}`);
            const absOutput = resolve(process.cwd(), `dist/${IMAGES_DIST_SUBFOLDER}/sprite.svg`);

            try {
                await fs.access(absInput);
            } catch {
                console.log(`ℹ️  Skipping SVG sprite generation for ${process.cwd()}`);
                return;
            }


            const files = (await fs.readdir(absInput)).filter(f => f.endsWith('.svg'));
            const sprites = svgstore();

            for (const file of files) {
                const id = basename(file, '.svg');
                const svg = await fs.readFile(join(absInput, file), 'utf8');
                sprites.add(id, svg);
            }

            await fs.writeFile(absOutput, sprites.toString());
            console.log(`✅ SVG sprite generated at ${absOutput}`);
        }
    };
}
