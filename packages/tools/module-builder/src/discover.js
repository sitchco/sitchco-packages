import path from 'node:path';
import { default as ProjectScanner } from '@sitchco/project-scanner';
import { DIST_FOLDER } from './config.js';

export async function findAssetTargets() {
    const service = new ProjectScanner();
    const { projectRoot } = service;
    const moduleRoots = await service.getModuleDirs();
    const entryPoints = await service.getEntrypoints();
    const webRoot = await service.getWebRoot();
    if (moduleRoots.length === 0 || entryPoints.length === 0) {
        return [];
    }

    const publicDirRelative = path.relative(projectRoot, webRoot).replace(/\\/g, '/');
    const outDirAbsolute = path.join(projectRoot, DIST_FOLDER);
    const buildDirRelative = path.relative(webRoot, outDirAbsolute).replace(/\\/g, '/');
    const inputPaths = entryPoints.map((fullPath) => path.relative(projectRoot, fullPath));
    const hotFileAbsolute = path.join(projectRoot, '.vite.hot');
    const hotFileRelative = path.relative(projectRoot, hotFileAbsolute).replace(/\\/g, '/');
    const refreshPaths = [`${projectRoot}/**/*.php`];
    return {
        root: projectRoot,
        outDir: outDirAbsolute,
        viteInput: inputPaths,
        vitePublicDir: publicDirRelative,
        viteBuildDir: buildDirRelative,
        viteHotFile: hotFileRelative,
        viteRefreshPaths: refreshPaths,
    };
}
