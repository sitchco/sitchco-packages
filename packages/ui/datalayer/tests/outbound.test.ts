import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerOutboundDecorator } from '../src/outbound';

function seedUtmParams(params: Record<string, string>): void {
    localStorage.setItem('utm_params', JSON.stringify(params));
}

function createLink(href: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    document.body.appendChild(a);
    return a;
}

describe('registerOutboundDecorator', () => {
    let cleanupFn: (() => void) | undefined;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.com', search: '' },
            writable: true,
        });
    });

    afterEach(() => {
        cleanupFn?.();
        cleanupFn = undefined;
        document.body.innerHTML = '';
    });

    it('decorates matching outbound links with UTM params', () => {
        seedUtmParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page');

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        const link = document.querySelector('a')!;
        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('does not overwrite existing UTM params on links', () => {
        seedUtmParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page?utm_source=existing');

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        const link = document.querySelector('a')!;
        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('existing');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('ignores internal links (same hostname)', () => {
        seedUtmParams({ utm_source: 'google' });
        const link = createLink('https://example.com/internal');

        cleanupFn = registerOutboundDecorator({ domains: ['example.com'] });

        expect(link.href).toBe('https://example.com/internal');
    });

    it('ignores links to non-matching domains', () => {
        seedUtmParams({ utm_source: 'google' });
        const link = createLink('https://other.com/page');

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        expect(link.href).toBe('https://other.com/page');
    });

    it('matches subdomains', () => {
        seedUtmParams({ utm_source: 'google' });
        createLink('https://shop.partner.com/page');

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        const link = document.querySelector('a')!;
        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates dynamically added links via MutationObserver', async () => {
        seedUtmParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        const link = createLink('https://partner.com/new');

        // Allow MutationObserver to process
        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates nested links inside dynamically added container elements', async () => {
        seedUtmParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        const div = document.createElement('div');
        const a = document.createElement('a');
        a.href = 'https://partner.com/nested';
        div.appendChild(a);
        document.body.appendChild(div);

        // Allow MutationObserver to process
        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(a.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('cleanup disconnects the observer', async () => {
        seedUtmParams({ utm_source: 'google' });

        const cleanup = registerOutboundDecorator({ domains: ['partner.com'] });
        cleanup();

        // Flush any pending microtasks
        await new Promise((resolve) => setTimeout(resolve, 0));

        const link = createLink('https://partner.com/after-cleanup');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(link.href).toBe('https://partner.com/after-cleanup');
    });

    it('returns no-op cleanup when no domains provided', () => {
        seedUtmParams({ utm_source: 'google' });

        cleanupFn = registerOutboundDecorator({ domains: [] });

        expect(cleanupFn).toBeTypeOf('function');
        expect(() => cleanupFn!()).not.toThrow();
        cleanupFn = undefined;
    });

    it('returns no-op cleanup when no UTM params stored', () => {
        cleanupFn = registerOutboundDecorator({ domains: ['partner.com'] });

        expect(cleanupFn).toBeTypeOf('function');
        expect(() => cleanupFn!()).not.toThrow();
        cleanupFn = undefined;
    });
});
