import { describe, it, expect } from 'vitest';
import prettierConfig from '../index.json';

describe('Prettier Config', () => {
    it('should export a valid Prettier configuration', () => {
        expect(prettierConfig).toBeDefined();
        expect(typeof prettierConfig).toBe('object');
    });
});
