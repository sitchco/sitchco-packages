import imagemin from 'imagemin';
import imageminSvgo from 'imagemin-svgo';
import { promises as fs } from 'fs';
import { glob } from 'glob';
import { IMAGES_DIST_PATTERN } from '@sitchco/project-scanner';

export default async function imageminDist(files = []) {
    if (!files.length) {
        files = await glob(`dist/${IMAGES_DIST_PATTERN}`);
    }

    await Promise.all(
        files.map(async (file) => {
            const buffer = await fs.readFile(file);
            const optimized = await imagemin.buffer(buffer, {
                plugins: [
                    imageminSvgo({
                        plugins: ['preset-default'],
                    }),
                ],
            });
            await fs.writeFile(file, optimized);
        })
    );
}
