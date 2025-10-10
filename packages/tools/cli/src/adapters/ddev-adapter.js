import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { BaseAdapter } from './base-adapter.js';

/**
 * DDEV adapter for executing commands in DDEV environments
 */
export class DdevAdapter extends BaseAdapter {
    constructor() {
        super('ddev', {
            priority: 10, // High priority for DDEV environments
            containerRoot: '/var/www/html',
            enforce: 0,
        });

        this.description = 'DDEV local development environment';
    }

    /**
     * Check if this adapter can handle the current environment
     */
    canHandle(env) {
        // If forced via environment variable
        if (process.env.SITCHCO_ADAPTER === 'ddev') {
            return true;
        }
        // If we're inside DDEV container
        if (env.IS_DDEV_PROJECT && env.IS_DDEV_PROJECT !== 'false') {
            return true;
        }
        // If DDEV is available and we're in a DDEV project
        if (this.isDdevAvailable() && this.findDdevRoot(process.cwd())) {
            return true;
        }
        return false;
    }

    /**
     * Execute a command in the DDEV environment
     */
    async execute(workingDir, command, args = []) {
        // If we're inside DDEV container, run directly
        if (this.isInsideDdevContainer()) {
            return await this.runOnHost(workingDir, command, args);
        }
        // Check if DDEV is available
        if (!this.isDdevAvailable()) {
            throw new Error('DDEV command not available');
        }

        // Find DDEV project root
        const ddevRoot = this.findDdevRoot(workingDir);
        if (!ddevRoot) {
            throw new Error('No .ddev directory found');
        }
        // Check if DDEV is running
        if (!this.isDdevRunning(ddevRoot)) {
            throw new Error('DDEV project detected but not running');
        }

        // Calculate relative path from DDEV root to working directory
        const relativePath = resolve(workingDir).replace(resolve(ddevRoot) + '/', '');
        const containerTarget =
            relativePath === '' ? this.options.containerRoot : `${this.options.containerRoot}/${relativePath}`;

        try {
            // Try to run inside DDEV
            return await this.runInDdev(ddevRoot, containerTarget, command, args);
        } catch (error) {
            if (this.options.enforce === 1) {
                throw error;
            }

            this.log(`DDEV exec failed (${error.message}); falling back to host execution.`, 'warn');
            return await this.runOnHost(workingDir, command, args);
        }
    }

    /**
     * Find the DDEV project root by looking for .ddev directory
     */
    findDdevRoot(startPath) {
        let currentPath = resolve(startPath);

        while (currentPath !== '/') {
            if (existsSync(resolve(currentPath, '.ddev'))) {
                return currentPath;
            }

            currentPath = dirname(currentPath);
        }
        return null;
    }

    /**
     * Check if DDEV is running for the given project
     */
    isDdevRunning(ddevRoot) {
        try {
            execSync('ddev describe', {
                cwd: ddevRoot,
                stdio: 'ignore',
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if currently running inside DDEV container
     */
    isInsideDdevContainer() {
        return process.env.IS_DDEV_PROJECT && process.env.IS_DDEV_PROJECT !== 'false';
    }

    /**
     * Check if DDEV command is available
     */
    isDdevAvailable() {
        try {
            execSync('which ddev', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Execute a command on the host machine
     */
    async runOnHost(workingDir, command, args = []) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: workingDir,
                stdio: 'inherit',
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Execute a command inside DDEV container
     */
    async runInDdev(ddevRoot, containerTarget, command, args = []) {
        return new Promise((resolve, reject) => {
            const ddevArgs = ['exec', '--dir', containerTarget, command, ...args];
            const child = spawn('ddev', ddevArgs, {
                cwd: ddevRoot,
                stdio: 'inherit',
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(`DDEV exec failed with exit code ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }
}
