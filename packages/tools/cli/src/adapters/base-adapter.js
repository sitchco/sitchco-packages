/**
 * Base adapter interface for environment-specific command execution
 * All adapters should extend this base class
 */
export class BaseAdapter {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.priority = options.priority || 0;
    }

    /**
     * Check if this adapter can handle the current environment
     * @param {Object} env - Environment information
     * @returns {boolean} - True if this adapter can handle the environment
     */
    canHandle(_env) {
        throw new Error('canHandle() must be implemented by adapter');
    }

    /**
     * Execute a command in this adapter's environment
     * @param {string} workingDir - Working directory for command execution
     * @param {string} command - Command to execute
     * @param {Array<string>} args - Arguments for the command
     * @returns {Promise<number>} - Exit code of the command
     */
    async execute(workingDir, command, _args = []) {
        throw new Error('execute() must be implemented by adapter');
    }

    /**
     * Get adapter information
     * @returns {Object} - Adapter metadata
     */
    getInfo() {
        return {
            name: this.name,
            priority: this.priority,
            description: this.description || `${this.name} adapter`,
        };
    }

    /**
     * Log adapter action
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error)
     */
    log(message, level = 'info') {
        const prefix = `[${this.name} adapter]`;

        switch (level) {
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }
}
