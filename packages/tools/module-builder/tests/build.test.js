import { describe, it, expect } from 'vitest';
import * as build from '../src/build.js';

describe('Module Builder', () => {
    it('should export build functionality', () => {
        expect(build).toBeDefined();
    });
});
