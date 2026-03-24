import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureUtmParams, getStoredUtmParams } from '../src/utm.js';

describe('captureUtmParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('captures UTM params from the URL and stores them', () => {
        Object.defineProperty(window, 'location', {
            value: { search: '?utm_source=google&utm_medium=cpc&utm_campaign=spring' },
            writable: true,
        });

        captureUtmParams();

        const stored = JSON.parse(localStorage.getItem('utm_params')!);
        expect(stored).toEqual({
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'spring',
        });
    });

    it('does not store anything when no UTM params are present', () => {
        Object.defineProperty(window, 'location', {
            value: { search: '?page=1&sort=asc' },
            writable: true,
        });

        captureUtmParams();

        expect(localStorage.getItem('utm_params')).toBeNull();
    });

    it('captures only recognized UTM params and ignores others', () => {
        Object.defineProperty(window, 'location', {
            value: { search: '?utm_source=fb&custom_param=xyz' },
            writable: true,
        });

        captureUtmParams();

        const stored = JSON.parse(localStorage.getItem('utm_params')!);
        expect(stored).toEqual({ utm_source: 'fb' });
    });

    it('second captureUtmParams call replaces stored params instead of merging', () => {
        Object.defineProperty(window, 'location', {
            value: { search: '?utm_source=google&utm_medium=cpc' },
            writable: true,
        });

        captureUtmParams();

        Object.defineProperty(window, 'location', {
            value: { search: '?utm_source=bing' },
            writable: true,
        });

        captureUtmParams();

        const stored = JSON.parse(localStorage.getItem('utm_params')!);
        expect(stored).toEqual({ utm_source: 'bing' });
        expect(stored).not.toHaveProperty('utm_medium');
    });

    it('handles localStorage errors gracefully', () => {
        Object.defineProperty(window, 'location', {
            value: { search: '?utm_source=google' },
            writable: true,
        });

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => captureUtmParams()).not.toThrow();

        vi.restoreAllMocks();
    });
});

describe('getStoredUtmParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('retrieves stored UTM params', () => {
        localStorage.setItem(
            'utm_params',
            JSON.stringify({ utm_source: 'google', utm_medium: 'cpc' }),
        );

        expect(getStoredUtmParams()).toEqual({
            utm_source: 'google',
            utm_medium: 'cpc',
        });
    });

    it('returns empty object when no key exists', () => {
        expect(getStoredUtmParams()).toEqual({});
    });

    it('returns empty object for corrupted JSON', () => {
        localStorage.setItem('utm_params', 'not-valid-json{{{');

        expect(getStoredUtmParams()).toEqual({});
    });

    it('returns empty object when parsed value is not an object', () => {
        localStorage.setItem('utm_params', '"just a string"');

        expect(getStoredUtmParams()).toEqual({});
    });

    it('handles localStorage getItem errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(getStoredUtmParams()).toEqual({});

        vi.restoreAllMocks();
    });
});
