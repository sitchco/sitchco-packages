import { describe, it, expect } from 'vitest';
import eslintConfig from '../index.js';

describe('ESLint Config', () => {
    it('should export a valid ESLint configuration', () => {
        expect(eslintConfig).toBeDefined();
        expect(Array.isArray(eslintConfig)).toBe(true);
    });
});
