import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureLandingParams, getStoredLandingParams } from '../src/landing-params';
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
