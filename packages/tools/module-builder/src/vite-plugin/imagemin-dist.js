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
                        plugins: [
                            {
                                name: 'removeViewBox',
                                active: false,
                            },
                            {
                                name: 'removeDimensions',
                                active: true,
                            },
                            {
                                name: 'removeXMLNS',
                                active: false,
                            }, // keep xmlns for external usage
                            {
                                name: 'removeXMLProcInst', // removes <?xml ... ?>
                                active: true,
                            },
                            {
                                name: 'removeDoctype', // removes <!DOCTYPE ...>
                                active: true,
                            },
                            {
                                name: 'removeComments',
                                active: true,
                            },
                            {
                                name: 'removeMetadata',
                                active: true,
                            },
                            {
                                name: 'removeTitle',
                                active: false,
                            },
                        ],
                    }),
                ],
            });
            await fs.writeFile(file, optimized);
        })
    );
}
