import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerOutboundDecorator } from '../src/outbound';
import type { LandingDomainEntry } from '../src/types';

function seedLandingParams(params: Record<string, string>): void {
    localStorage.setItem('landing_params', JSON.stringify(params));
}

function createLink(href: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    document.body.appendChild(a);
    return a;
}

function entry(domain: string, extraParams: string[] = []): LandingDomainEntry {
    return { domain, extraParams };
}

describe('registerOutboundDecorator', () => {
    let cleanupFn: (() => void) | undefined;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.local', search: '' },
            writable: true,
        });
    });

    afterEach(() => {
        cleanupFn?.();
        cleanupFn = undefined;
        document.body.innerHTML = '';
    });

    it('decorates matching outbound links with UTM defaults (S4 UTM portion)', () => {
        seedLandingParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page');

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = document.querySelector('a')!;
        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('forwards extraParams to the matched domain (S4 extras)', () => {
        seedLandingParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1' });
        createLink('https://partner.com/page');

        cleanupFn = registerOutboundDecorator({
            domains: [entry('partner.com', ['tess', 'session_hash'])],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('x');
        expect(url.searchParams.get('tess')).toBe('abc');
        expect(url.searchParams.get('session_hash')).toBe('h1');
    });

    it('does not leak extras across domains (constraint-1)', () => {
        seedLandingParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1' });
        const partnerLink = createLink('https://partner.com/page');
        const exampleLink = createLink('https://example.com/page');

        cleanupFn = registerOutboundDecorator({
            domains: [
                entry('partner.com', ['tess', 'session_hash']),
                entry('example.com', ['tess']),
            ],
        });

        const partnerUrl = new URL(partnerLink.href);
        expect(partnerUrl.searchParams.get('session_hash')).toBe('h1');
        expect(partnerUrl.searchParams.get('tess')).toBe('abc');

        const exampleUrl = new URL(exampleLink.href);
        expect(exampleUrl.searchParams.get('tess')).toBe('abc');
        expect(exampleUrl.searchParams.has('session_hash')).toBe(false);
    });

    it('still forwards UTM defaults when extras are empty (S5)', () => {
        seedLandingParams({ utm_source: 'g', utm_medium: 'cpc', tess: 'abc' });
        createLink('https://shop.partner.com/page');

        cleanupFn = registerOutboundDecorator({
            domains: [entry('shop.partner.com')],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('g');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
        expect(url.searchParams.has('tess')).toBe(false);
    });

    it('first-match-wins on overlapping rows (S6)', () => {
        seedLandingParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1', shop_id: 'S' });
        createLink('https://shop.partner.com/page');

        cleanupFn = registerOutboundDecorator({
            domains: [
                entry('partner.com', ['tess', 'session_hash']),
                entry('shop.partner.com', ['tess', 'shop_id']),
            ],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('session_hash')).toBe('h1');
        expect(url.searchParams.get('tess')).toBe('abc');
        expect(url.searchParams.has('shop_id')).toBe(false);
    });

    it('does not overwrite existing UTM params on links (N3)', () => {
        seedLandingParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page?utm_source=existing');

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('existing');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('does not overwrite existing extra params on links (N3 extras)', () => {
        seedLandingParams({ utm_source: 'google', tess: 'auto' });
        createLink('https://partner.com/page?tess=manual');

        cleanupFn = registerOutboundDecorator({
            domains: [entry('partner.com', ['tess'])],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('tess')).toBe('manual');
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('ignores internal links (N2)', () => {
        seedLandingParams({ utm_source: 'google' });
        const link = createLink('https://example.local/internal');

        cleanupFn = registerOutboundDecorator({ domains: [entry('example.local')] });

        expect(link.href).toBe('https://example.local/internal');
    });

    it('ignores links to non-configured domains (N1)', () => {
        seedLandingParams({ utm_source: 'google' });
        const link = createLink('https://other.com/page');

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        expect(link.href).toBe('https://other.com/page');
    });

    it('does not match similar-named hostnames (no false subdomain match)', () => {
        seedLandingParams({ utm_source: 'google' });
        const evilSuffix = createLink('https://evilpartner.com/page');
        const evilSubdomain = createLink('https://partner.evil.com/page');

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        expect(evilSuffix.href).toBe('https://evilpartner.com/page');
        expect(evilSubdomain.href).toBe('https://partner.evil.com/page');
    });

    it('matches true subdomains via dotted-suffix rule', () => {
        seedLandingParams({ utm_source: 'google' });
        createLink('https://shop.partner.com/page');

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates dynamically added links via MutationObserver', async () => {
        seedLandingParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = createLink('https://partner.com/new');

        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates nested links inside dynamically added container elements', async () => {
        seedLandingParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const div = document.createElement('div');
        const a = document.createElement('a');
        a.href = 'https://partner.com/nested';
        div.appendChild(a);
        document.body.appendChild(div);

        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(a.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('cleanup disconnects the observer', async () => {
        seedLandingParams({ utm_source: 'google' });

        const cleanup = registerOutboundDecorator({ domains: [entry('partner.com')] });
        cleanup();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const link = createLink('https://partner.com/after-cleanup');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(link.href).toBe('https://partner.com/after-cleanup');
    });

    it('returns no-op cleanup when no domains provided', () => {
        seedLandingParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: [] });

        expect(cleanupFn).toBeTypeOf('function');
        expect(() => cleanupFn!()).not.toThrow();
        cleanupFn = undefined;
    });

    it('returns no-op cleanup when domains key is absent', () => {
        seedLandingParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({});

        expect(cleanupFn).toBeTypeOf('function');
        expect(() => cleanupFn!()).not.toThrow();
        cleanupFn = undefined;
    });

    it('returns no-op cleanup when no landing params stored', () => {
        cleanupFn = registerOutboundDecorator({ domains: [entry('partner.com')] });

        expect(cleanupFn).toBeTypeOf('function');
        expect(() => cleanupFn!()).not.toThrow();
        cleanupFn = undefined;
    });
});
