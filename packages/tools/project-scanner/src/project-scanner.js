import { glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Configuration constants for project structure scanning.
 */
export const MODULES_FOLDER = 'modules';

export const ASSETS_FOLDER = 'assets';

export const BLOCKS_FOLDER = 'blocks';

export const SCRIPTS_SUBFOLDER = 'scripts';

export const STYLES_SUBFOLDER = 'styles';

export const ENTRY_FILE_PATTERN = '*.{js,mjs,scss,css}';

/**
 * Scans a project structure to discover Sitchco modules, their asset directories,
 * entry points (JS/SCSS), and source files by extension. Caches discovered paths
 * for efficiency.
 */
export default class ProjectScanner {
    /** @type {string} The absolute path to the project root. */
    projectRoot;
    /** @type {string[]} Glob patterns to ignore during scanning. */
    ignorePatterns;
    /** @type {string[] | null} Cached array of module directory paths. */
    _moduleDirs = null;
    /** @type {string[] | null} Cached array of entry point file paths. */
    _entrypoints = null;
    /** @type {string | null} Cached absolute path to the WordPress web root. */
    _webRoot = null;
    static DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', '**/vendor/**', '**/dist/**', '**/build/**'];

    /**
     * Creates an instance of ProjectScanner.
     * @param {object} [options={}] - Configuration options.
     * @param {string} [options.projectRoot=process.cwd()] - The root directory of the project to scan.
     * @param {string[]} [options.ignorePatterns=ProjectScanner.DEFAULT_IGNORE] - Glob patterns to ignore.
     */
    constructor(options = {}) {
        this.projectRoot = path.resolve(options.projectRoot || process.cwd());
        this.ignorePatterns = options.ignorePatterns || ProjectScanner.DEFAULT_IGNORE;
    }

    /**
     * Checks if a directory exists.
     * @param {string} path - The path to check.
     * @returns {Promise<boolean>} True if the path is an existing directory.
     * @private
     * @static
     */
    static async _pathExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }

            throw error;
        }
    }

    /**
     * Scans the project for module directories (containing `.sitchco-module`).
     * @returns {Promise<string[]>} A promise resolving to an array of absolute module directory paths.
     * @private
     */
    async _scanForModuleDirs() {
        const markerPattern = `${MODULES_FOLDER}/*/`;
        return await glob(markerPattern, {
            cwd: this.projectRoot,
            absolute: true,
            dot: true,
            ignore: this.ignorePatterns,
        });
    }

    /**
     * Gets the list of module directories, using cache if available.
     * @returns {Promise<string[]>} A promise resolving to an array of absolute module directory paths.
     */
    async getModuleDirs() {
        if (this._moduleDirs === null) {
            this._moduleDirs = await this._scanForModuleDirs();
        }
        return this._moduleDirs;
    }

    /**
     * Scans module directories for entry points (JS/MJS/SCSS files).
     * It looks in the module root, module assets/scripts|styles folders,
     * block roots (within the blocks folder), and block assets/scripts|styles folders.
     * @returns {Promise<string[]>} A promise resolving to a flat array of absolute entry point file paths.
     * @private
     */
    async _scanForEntrypoints() {
        const moduleDirs = await this.getModuleDirs();
        if (!moduleDirs.length) {
            return [];
        }

        const entrypointPatterns = [
            ENTRY_FILE_PATTERN,
            `${ASSETS_FOLDER}/{${SCRIPTS_SUBFOLDER},${STYLES_SUBFOLDER}}/${ENTRY_FILE_PATTERN}`,
            `${BLOCKS_FOLDER}/*/${ENTRY_FILE_PATTERN}`,
            `${BLOCKS_FOLDER}/*/${ASSETS_FOLDER}/{${SCRIPTS_SUBFOLDER},${STYLES_SUBFOLDER}}/${ENTRY_FILE_PATTERN}`,
        ];
        const promises = moduleDirs.map(
            async (moduleDir) =>
                await glob(entrypointPatterns, {
                    cwd: moduleDir,
                    absolute: true,
                    nodir: true,
                    ignore: this.ignorePatterns,
                })
        );
        const results = await Promise.all(promises);
        const allEntrypoints = results.flat();
        return [...new Set(allEntrypoints)];
    }

    /**
     * Gets the list of all entry point files (JS/MJS/SCSS) found in standard locations
     * across all module directories, using cache if available.
     * (Locations include module root, module assets, block roots, block assets).
     * @returns {Promise<string[]>} A promise resolving to a flat array of absolute entry point file paths.
     */
    async getEntrypoints() {
        if (this._entrypoints === null) {
            this._entrypoints = await this._scanForEntrypoints();
        }
        return this._entrypoints;
    }

    /**
     * Scans upwards from the project root to find the WordPress web root
     * (the directory containing 'wp-content').
     * @returns {Promise<string>} A promise resolving to the absolute path of the web root.
     * @throws {Error} If the web root cannot be found.
     * @private
     */
    async _scanForWebRoot() {
        let currentDir = path.normalize(this.projectRoot);
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const wpContentPath = path.join(currentDir, 'wp-content');
            if (await ProjectScanner._pathExists(wpContentPath)) {
                return currentDir;
            }

            currentDir = path.dirname(currentDir);
        }
        return path.resolve(this.projectRoot, '../../..');
    }

    /**
     * Gets the WordPress web root directory path, using cache if available.
     * @returns {Promise<string>} A promise resolving to the absolute web root path.
     */
    async getWebRoot() {
        if (this._webRoot === null) {
            this._webRoot = await this._scanForWebRoot();
        }
        return this._webRoot;
    }

    /**
     * Finds all source files within the identified module directories (not limited to asset directories)
     * matching the specified extensions. This method does NOT use caching as extensions can vary per call.
     *
     * @param {string[]} extensions - An array of file extensions to find (e.g., ['.php', '.json', '.svg']).
     * @returns {Promise<string[]>} A promise resolving to a flat array of absolute source file paths matching the extensions.
     */
    async findModuleSourceFiles(extensions = []) {
        if (!extensions || extensions.length === 0) {
            return [];
        }

        const moduleDirs = await this.getModuleDirs();
        if (!moduleDirs.length) {
            return [];
        }

        const extGroupPattern = `{${extensions.map((ext) => (ext.startsWith('.') ? ext.substring(1) : ext)).join(',')}}`;
        const findPattern = `**/*.${extGroupPattern}`;
        const promises = moduleDirs.map(async (moduleDir) => {
            const files = await glob(findPattern, {
                cwd: moduleDir,
                absolute: true,
                nodir: true,
                dot: true,
                ignore: this.ignorePatterns,
            });
            return files;
        });
        const results = await Promise.all(promises);
        const allSourceFiles = results.flat();
        return [...new Set(allSourceFiles)];
    }

    /**
     * Finds all source files within the entire project (starting from project root)
     * matching the specified extensions. This method does NOT use caching as extensions can vary per call.
     *
     * @param {string[]} extensions - An array of file extensions to find (e.g., ['.php', '.json', '.svg']).
     * @returns {Promise<string[]>} A promise resolving to a flat array of absolute source file paths matching the extensions.
     */
    async findAllSourceFiles(extensions = []) {
        if (!extensions || extensions.length === 0) {
            return [];
        }

        const extGroupPattern = `{${extensions.map((ext) => (ext.startsWith('.') ? ext.substring(1) : ext)).join(',')}}`;
        const findPattern = `**/*.${extGroupPattern}`;
        const files = await glob(findPattern, {
            cwd: this.projectRoot,
            absolute: true,
            nodir: true,
            dot: true,
            ignore: this.ignorePatterns,
        });
        return [...new Set(files)];
    }

    /**
     * Finds all build artifact directories (dist, .vite) within the project root.
     * This method does NOT use caching.
     * @returns {Promise<string[]>} A promise resolving to a flat array of absolute artifact directory paths.
     */
    async getBuildArtifacts() {
        const artifactPatterns = ['**/dist', '**/.vite'];
        const filteredIgnorePatterns = this.ignorePatterns.filter(
            (pattern) => !pattern.includes('dist') && !pattern.includes('.vite')
        );
        const artifactDirs = await glob(artifactPatterns, {
            cwd: this.projectRoot,
            absolute: true,
            onlyDirectories: true,
            dot: true,
            ignore: filteredIgnorePatterns,
        });
        return [...new Set(artifactDirs)];
    }

    /**
     * Removes all found build artifact directories (dist, .vite).
     * @returns {Promise<void>} A promise that resolves when deletion is complete.
     */
    async cleanBuildArtifacts() {
        const artifactDirs = await this.getBuildArtifacts();
        if (!artifactDirs.length) {
            return;
        }

        const promises = artifactDirs.map(async (dirPath) => {
            try {
                await fs.rm(dirPath, {
                    recursive: true,
                    force: true,
                });
            } catch (error) {
                console.error(`[ProjectScanner] Error removing directory ${dirPath}:`, error);
            }
        });
        await Promise.all(promises);
    }

    /**
     * Clears the internal cache for module directories, asset directories, and entrypoints.
     * Subsequent calls to getters will trigger a fresh scan.
     */
    clearCache() {
        this._moduleDirs = null;
        this._entrypoints = null;
        this._webRoot = null;
    }
}

export { ProjectScanner };
