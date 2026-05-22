import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureUrlParams, registerOutboundDecorator } from '../src/outbound';
import {
    getStoredOutboundParams,
    updateStoredOutboundParams,
    removeStoredOutboundParams,
} from '../src/outbound-params';
import type { OutboundDecoratorConfig, OutboundDecoratorHandle } from '../src/types';

const MINIMAL_CONFIG: OutboundDecoratorConfig = {
    domains: [{ domain: 'partner.com' }],
};

function setLocation(search: string): void {
    Object.defineProperty(window, 'location', {
        value: { search },
        writable: true,
    });
}

describe('captureUrlParams', () => {
    let handle: OutboundDecoratorHandle | null = null;

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        handle?.cleanup();
        handle = null;
    });

    it('captures UTM defaults from the URL and stores them under outbound_params', () => {
        setLocation('?utm_source=google&utm_medium=cpc&utm_campaign=spring');

        handle = registerOutboundDecorator(MINIMAL_CONFIG);
        captureUrlParams();

        const stored = JSON.parse(localStorage.getItem('outbound_params')!);
        expect(stored).toEqual({
            utm_source: 'google',
            utm_medium: 'cpc',
            utm_campaign: 'spring',
        });
        expect(localStorage.getItem('utm_params')).toBeNull();
    });

    it('captures arbitrary params declared via domain extraParams (S1)', () => {
        setLocation('?utm_source=fb&tess=abc&session_hash=h1&ignored=xx');

        handle = registerOutboundDecorator({
            domains: [
                { domain: 'partner.com', extraParams: ['tess', 'session_hash'] },
                { domain: 'example.com', extraParams: ['tess'] },
            ],
        });
        captureUrlParams();

        const stored = JSON.parse(localStorage.getItem('outbound_params')!);
        expect(stored).toEqual({
            utm_source: 'fb',
            tess: 'abc',
            session_hash: 'h1',
        });
        expect(stored).not.toHaveProperty('ignored');
    });

    it('preserves sticky storage when URL has no allowlisted params (S2)', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'facebook', tess: 'abc' }),
        );
        setLocation('?page=1&ignored=xx');

        handle = registerOutboundDecorator({
            domains: [{ domain: 'partner.com', extraParams: ['tess'] }],
        });
        captureUrlParams();

        const stored = JSON.parse(localStorage.getItem('outbound_params')!);
        expect(stored).toEqual({ utm_source: 'facebook', tess: 'abc' });
    });

    it('merges new URL params into existing storage (S3)', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'facebook', tess: 'abc' }),
        );
        setLocation('?utm_source=google');

        handle = registerOutboundDecorator({
            domains: [{ domain: 'partner.com', extraParams: ['tess'] }],
        });
        captureUrlParams();

        const stored = JSON.parse(localStorage.getItem('outbound_params')!);
        expect(stored).toEqual({ utm_source: 'google', tess: 'abc' });
    });

    it('rejects extraParams whose names violate the token regex', () => {
        setLocation('?utm_source=fb&tess=abc&bad%20name=zzz');

        handle = registerOutboundDecorator({
            domains: [
                { domain: 'partner.com', extraParams: ['tess', 'bad name', '<script>', ''] },
            ],
        });
        captureUrlParams();

        const stored = JSON.parse(localStorage.getItem('outbound_params')!);
        expect(stored).toEqual({ utm_source: 'fb', tess: 'abc' });
        expect(stored).not.toHaveProperty('bad name');
    });

    it('handles localStorage errors gracefully', () => {
        setLocation('?utm_source=google');

        handle = registerOutboundDecorator(MINIMAL_CONFIG);

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => captureUrlParams()).not.toThrow();

        vi.restoreAllMocks();
    });

    it('is a no-op when no decorator is registered', () => {
        setLocation('?utm_source=google');

        captureUrlParams();

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });
});

describe('getStoredOutboundParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('retrieves stored outbound params from outbound_params key', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc' }),
        );

        expect(getStoredOutboundParams()).toEqual({
            utm_source: 'google',
            tess: 'abc',
        });
    });

    it('returns empty object when no key exists', () => {
        expect(getStoredOutboundParams()).toEqual({});
    });

    it('returns empty object for corrupted JSON', () => {
        localStorage.setItem('outbound_params', 'not-valid-json{{{');

        expect(getStoredOutboundParams()).toEqual({});
    });

    it('returns empty object when parsed value is not an object', () => {
        localStorage.setItem('outbound_params', '"just a string"');

        expect(getStoredOutboundParams()).toEqual({});
    });

    it('handles localStorage getItem errors gracefully', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(getStoredOutboundParams()).toEqual({});

        vi.restoreAllMocks();
    });

    it('filters out non-string values from the stored blob (Suggestion #6 gap 4)', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'g', vid: 123, foo: true, bar: null }),
        );

        expect(getStoredOutboundParams()).toEqual({ utm_source: 'g' });
    });
});

describe('updateStoredOutboundParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('merges runtime values into the existing blob (runtime wins)', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc' }),
        );

        updateStoredOutboundParams({ utm_source: 'fb', vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
            utm_source: 'fb',
            tess: 'abc',
            vid: 'v1',
        });
    });

    it('writes a fresh blob when storage is empty', () => {
        updateStoredOutboundParams({ vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({ vid: 'v1' });
    });

    it('writes a fresh blob when storage is corrupt', () => {
        localStorage.setItem('outbound_params', 'not-valid-json{{{');

        updateStoredOutboundParams({ vid: 'v1' });

        expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({ vid: 'v1' });
    });

    it('does not throw when localStorage.setItem throws', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        expect(() => updateStoredOutboundParams({ vid: 'v1' })).not.toThrow();

        vi.restoreAllMocks();
    });
});

describe('removeStoredOutboundParams', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('removes specific keys but leaves the rest in place', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'google', tess: 'abc', vid: 'v1' }),
        );

        removeStoredOutboundParams(['vid']);

        expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
            utm_source: 'google',
            tess: 'abc',
        });
    });

    it('removes the storage key entirely when no keys are given', () => {
        localStorage.setItem(
            'outbound_params',
            JSON.stringify({ utm_source: 'google', vid: 'v1' }),
        );

        removeStoredOutboundParams();

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });

    it('removes the storage key when trimming leaves the blob empty', () => {
        localStorage.setItem('outbound_params', JSON.stringify({ vid: 'v1' }));

        removeStoredOutboundParams(['vid']);

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });

    it('wipes a corrupt blob even on targeted removal (S5)', () => {
        localStorage.setItem('outbound_params', '{not-json');

        removeStoredOutboundParams(['vid']);

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });

    it('does not throw when localStorage.removeItem throws', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        expect(() => removeStoredOutboundParams()).not.toThrow();

        vi.restoreAllMocks();
    });
});
