import { describe, it, expect } from 'vitest';
import * as projectScanner from '../src/project-scanner.js';

describe('Project Scanner', () => {
    it('should export project scanning functionality', () => {
        expect(projectScanner).toBeDefined();
    });
});
