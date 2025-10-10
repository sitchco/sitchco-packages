import { spawn } from 'child_process';
import { BaseAdapter } from './base-adapter.js';

/**
 * Local adapter for executing commands directly on the host machine
 * This is the fallback adapter that works in any environment
 */
export class LocalAdapter extends BaseAdapter {
    constructor() {
        super('local', {
            priority: 0, // Lowest priority, used as fallback
        });

        this.description = 'Local environment execution (fallback)';
    }

    /**
     * Check if this adapter can handle the current environment
     */
    canHandle(_env) {
        // If forced via environment variable
        if (process.env.SITCHCO_ADAPTER === 'local') {
            return true;
        }
        // Local adapter can always handle as a fallback
        return true;
    }

    /**
     * Execute a command directly on the host machine
     */
    async execute(workingDir, command, args = []) {
        this.log(`Executing "${command} ${args.join(' ')}" in ${workingDir}`);
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: workingDir,
                stdio: 'inherit',
                shell: true, // Use shell for better compatibility
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
}
