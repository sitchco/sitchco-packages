import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    captureLandingParams,
    getStoredLandingParams,
    updateStoredLandingParams,
    removeStoredLandingParams,
} from '../src/landing-params';
import type { LandingParamsConfig } from '../src/types';

const EMPTY_CONFIG: LandingParamsConfig = {};

function setLocation(search: string): void {
    Object.defineProperty(window, 'location', {
        value: { search },
        writable: true,
    });
}

describe('captureLandingParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('captures UTM defaults from the URL and stores them under landing_params', () => {
        setLocation('?utm_source=google&utm_medium=cpc&utm_campaign=spring');

        captureLandingParams(EMPTY_CONFIG);

        const stored = JSON.parse(localStorage.getItem('landing_params')!);
        expect(stored).toEqual({
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'spring',
        });
        expect(localStorage.getItem('utm_params')).toBeNull();
    });

    it('captures arbitrary params declared via domain extraParams (S1)', () => {
        setLocation('?utm_source=fb&tess=abc&session_hash=h1&ignored=xx');

        captureLandingParams({
            domains: [
                { domain: 'partner.com', extraParams: ['tess', 'session_hash'] },
                { domain: 'example.com', extraParams: ['tess'] },
            ],
        });

        const stored = JSON.parse(localStorage.getItem('landing_params')!);
        expect(stored).toEqual({
            utm_source: 'fb',
            tess: 'abc',
            session_hash: 'h1',
        });
        expect(stored).not.toHaveProperty('ignored');
    });

    it('preserves sticky storage when URL has no allowlisted params (S2)', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'facebook', tess: 'abc' }),
        );
        setLocation('?page=1&ignored=xx');

        captureLandingParams({
            domains: [{ domain: 'partner.com', extraParams: ['tess'] }],
        });

        const stored = JSON.parse(localStorage.getItem('landing_params')!);
        expect(stored).toEqual({ utm_source: 'facebook', tess: 'abc' });
    });

    it('replaces stored params rather than merging when new ones land (S3)', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'facebook', tess: 'abc' }),
        );
        setLocation('?utm_source=google');

        captureLandingParams(EMPTY_CONFIG);

        const stored = JSON.parse(localStorage.getItem('landing_params')!);
        expect(stored).toEqual({ utm_source: 'google' });
        expect(stored).not.toHaveProperty('tess');
    });

    it('rejects extraParams whose names violate the token regex', () => {
        setLocation('?utm_source=fb&tess=abc&bad%20name=zzz');

        captureLandingParams({
            domains: [
                { domain: 'partner.com', extraParams: ['tess', 'bad name', '<script>', ''] },
            ],
        });

        const stored = JSON.parse(localStorage.getItem('landing_params')!);
        expect(stored).toEqual({ utm_source: 'fb', tess: 'abc' });
        expect(stored).not.toHaveProperty('bad name');
    });

    it('handles localStorage errors gracefully', () => {
        setLocation('?utm_source=google');

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => captureLandingParams(EMPTY_CONFIG)).not.toThrow();

        vi.restoreAllMocks();
    });
});

describe('getStoredLandingParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('retrieves stored landing params from landing_params key', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc' }),
        );

        expect(getStoredLandingParams()).toEqual({
            utm_source: 'google',
            tess: 'abc',
        });
    });

    it('returns empty object when no key exists', () => {
        expect(getStoredLandingParams()).toEqual({});
    });

    it('returns empty object for corrupted JSON', () => {
        localStorage.setItem('landing_params', 'not-valid-json{{{');

        expect(getStoredLandingParams()).toEqual({});
    });

    it('returns empty object when parsed value is not an object', () => {
        localStorage.setItem('landing_params', '"just a string"');

        expect(getStoredLandingParams()).toEqual({});
    });

    it('handles localStorage getItem errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(getStoredLandingParams()).toEqual({});

        vi.restoreAllMocks();
    });
});

describe('updateStoredLandingParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('merges runtime values into the existing blob (runtime wins)', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc' }),
        );

        updateStoredLandingParams({ utm_source: 'fb', vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('landing_params')!)).toEqual({
            utm_source: 'fb',
            tess: 'abc',
            vid: 'v1',
        });
    });

    it('writes a fresh blob when storage is empty', () => {
        updateStoredLandingParams({ vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('landing_params')!)).toEqual({ vid: 'v1' });
    });

    it('writes a fresh blob when storage is corrupt', () => {
        localStorage.setItem('landing_params', 'not-valid-json{{{');

        updateStoredLandingParams({ vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('landing_params')!)).toEqual({ vid: 'v1' });
    });

    it('does not throw when localStorage.setItem throws', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => updateStoredLandingParams({ vid: 'v1' })).not.toThrow();

        vi.restoreAllMocks();
    });
});

describe('removeStoredLandingParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('removes specific keys but leaves the rest in place', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc', vid: 'v1' }),
        );

        removeStoredLandingParams(['vid']);

        expect(JSON.parse(localStorage.getItem('landing_params')!)).toEqual({
            utm_source: 'google',
            tess: 'abc',
        });
    });

    it('removes the storage key entirely when no keys are given', () => {
        localStorage.setItem(
            'landing_params',
            JSON.stringify({ utm_source: 'google', vid: 'v1' }),
        );

        removeStoredLandingParams();

        expect(localStorage.getItem('landing_params')).toBeNull();
    });

    it('removes the storage key when trimming leaves the blob empty', () => {
        localStorage.setItem('landing_params', JSON.stringify({ vid: 'v1' }));

        removeStoredLandingParams(['vid']);

        expect(localStorage.getItem('landing_params')).toBeNull();
    });

    it('wipes a corrupt blob even on targeted removal (S5)', () => {
        localStorage.setItem('landing_params', '{not-json');

        removeStoredLandingParams(['vid']);

        expect(localStorage.getItem('landing_params')).toBeNull();
    });

    it('does not throw when localStorage.removeItem throws', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(() => removeStoredLandingParams()).not.toThrow();

        vi.restoreAllMocks();
    });
});
