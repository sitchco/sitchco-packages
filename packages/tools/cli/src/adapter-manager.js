import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { DdevAdapter } from './adapters/ddev-adapter.js';
import { LocalAdapter } from './adapters/local-adapter.js';

/**
 * Adapter manager for discovering and selecting appropriate execution adapters
 */
export class AdapterManager {
    constructor() {
        this.adapters = new Map();
        this.registerBuiltInAdapters();
    }

    /**
     * Register built-in adapters
     */
    registerBuiltInAdapters() {
        this.register(new DdevAdapter());
        this.register(new LocalAdapter());
    }

    /**
     * Register an adapter
     * @param {BaseAdapter} adapter - Adapter instance to register
     */
    register(adapter) {
        this.adapters.set(adapter.name, adapter);
    }

    /**
     * Get all registered adapters
     * @returns {Array<BaseAdapter>} - Array of all adapters
     */
    getAllAdapters() {
        return Array.from(this.adapters.values());
    }

    /**
     * Get current environment information
     * @returns {Object} - Environment information
     */
    getEnvironmentInfo() {
        return {
            IS_DDEV_PROJECT: process.env.IS_DDEV_PROJECT,
            NODE_ENV: process.env.NODE_ENV,
            cwd: process.cwd(),
            platform: process.platform,
            forcedAdapter: process.env.SITCHCO_ADAPTER,
        };
    }

    /**
     * Select the best adapter for the current environment
     * @param {Object} options - Selection options
     * @returns {BaseAdapter} - Selected adapter
     */
    selectAdapter(options = {}) {
        const env = this.getEnvironmentInfo();
        // If a specific adapter is forced via environment variable
        if (env.forcedAdapter && this.adapters.has(env.forcedAdapter)) {
            const adapter = this.adapters.get(env.forcedAdapter);
            console.log(`Using forced adapter: ${adapter.name}`);
            return adapter;
        }
        // If a specific adapter is requested via options
        if (options.adapter && this.adapters.has(options.adapter)) {
            const adapter = this.adapters.get(options.adapter);
            console.log(`Using requested adapter: ${adapter.name}`);
            return adapter;
        }

        // Auto-select based on environment detection
        const suitableAdapters = this.getAllAdapters()
            .filter((adapter) => adapter.canHandle(env))
            .sort((a, b) => b.priority - a.priority); // Higher priority first
        if (suitableAdapters.length === 0) {
            throw new Error('No suitable adapter found for current environment');
        }

        const selectedAdapter = suitableAdapters[0];
        console.log(`Auto-selected adapter: ${selectedAdapter.name}`);

        // Log other suitable adapters for debugging
        if (suitableAdapters.length > 1) {
            const others = suitableAdapters
                .slice(1)
                .map((a) => a.name)
                .join(', ');
            console.log(`Other suitable adapters: ${others}`);
        }
        return selectedAdapter;
    }

    /**
     * Execute a command using the best available adapter
     * @param {string} workingDir - Working directory for command execution
     * @param {string} command - Command to execute
     * @param {Array<string>} args - Arguments for the command
     * @param {Object} options - Execution options
     * @returns {Promise<number>} - Exit code of the command
     */
    async execute(workingDir, command, args = [], options = {}) {
        try {
            const adapter = this.selectAdapter(options);
            if (options.verbose) {
                console.log(`Using ${adapter.name} adapter to execute: ${command} ${args.join(' ')}`);
                console.log(`Working directory: ${workingDir}`);
            }
            return await adapter.execute(workingDir, command, args);
        } catch (error) {
            // If adapter fails and we're not using local adapter, try fallback
            if (options.adapter !== 'local' && process.env.SITCHCO_ADAPTER !== 'local') {
                console.warn(`Primary adapter failed: ${error.message}`);
                console.log('Falling back to local adapter...');

                try {
                    const localAdapter = this.adapters.get('local');
                    return await localAdapter.execute(workingDir, command, args);
                } catch (fallbackError) {
                    console.error('Both primary and local adapters failed');
                    throw fallbackError;
                }
            }

            throw error;
        }
    }

    /**
     * Load adapters from package.json configuration
     * @param {string} packageJsonPath - Path to package.json file
     */
    async loadFromConfig(packageJsonPath = null) {
        if (!packageJsonPath) {
            packageJsonPath = this.findPackageJson(process.cwd());
        }
        if (!packageJsonPath || !existsSync(packageJsonPath)) {
            return;
        }

        try {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            const sitchcoConfig = packageJson.sitchco || {};
            if (sitchcoConfig.adapters) {
                console.log('Loading custom adapters from package.json...');
                // Future: Load custom adapters from configuration
                // For now, just log that custom adapters are configured
                sitchcoConfig.adapters.forEach((adapterName) => {
                    console.log(`Custom adapter configured: ${adapterName}`);
                });
            }
            // Apply configuration options
            if (sitchcoConfig.defaultAdapter) {
                console.log(`Default adapter configured: ${sitchcoConfig.defaultAdapter}`);
            }
        } catch (error) {
            console.warn(`Failed to load configuration from ${packageJsonPath}:`, error.message);
        }
    }

    /**
     * Find package.json file by traversing up from current directory
     * @param {string} startDir - Directory to start searching from
     * @returns {string|null} - Path to package.json or null if not found
     */
    findPackageJson(startDir) {
        let currentDir = resolve(startDir);

        while (currentDir !== '/') {
            const packageJsonPath = resolve(currentDir, 'package.json');
            if (existsSync(packageJsonPath)) {
                return packageJsonPath;
            }

            currentDir = dirname(currentDir);
        }
        return null;
    }

    /**
     * List all available adapters with their information
     * @returns {Array<Object>} - Array of adapter information
     */
    listAdapters() {
        return this.getAllAdapters().map((adapter) => adapter.getInfo());
    }
}
