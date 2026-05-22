import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { captureUrlParams, registerOutboundDecorator } from '../src/outbound';
import type { OutboundDomainEntry, OutboundDecoratorHandle } from '../src/types';

function seedOutboundParams(params: Record<string, string>): void {
    localStorage.setItem('outbound_params', JSON.stringify(params));
}

function createLink(href: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    document.body.appendChild(a);
    return a;
}

function entry(domain: string, extraParams: string[] = []): OutboundDomainEntry {
    return { domain, extraParams };
}

describe('registerOutboundDecorator', () => {
    let handle: OutboundDecoratorHandle | undefined;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
            value: { hostname: 'example.local', search: '' },
            writable: true,
        });
    });

    afterEach(() => {
        handle?.cleanup();
        handle = undefined;
        document.body.innerHTML = '';
    });

    it('decorates matching outbound links with UTM defaults (S4 UTM portion)', () => {
        seedOutboundParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page');

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = document.querySelector('a')!;
        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('forwards extraParams to the matched domain (S4 extras)', () => {
        seedOutboundParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1' });
        createLink('https://partner.com/page');

        handle = registerOutboundDecorator({
            domains: [entry('partner.com', ['tess', 'session_hash'])],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('x');
        expect(url.searchParams.get('tess')).toBe('abc');
        expect(url.searchParams.get('session_hash')).toBe('h1');
    });

    it('does not leak extras across domains (constraint-1)', () => {
        seedOutboundParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1' });
        const partnerLink = createLink('https://partner.com/page');
        const exampleLink = createLink('https://example.com/page');

        handle = registerOutboundDecorator({
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
        seedOutboundParams({ utm_source: 'g', utm_medium: 'cpc', tess: 'abc' });
        createLink('https://shop.partner.com/page');

        handle = registerOutboundDecorator({
            domains: [entry('shop.partner.com')],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('g');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
        expect(url.searchParams.has('tess')).toBe(false);
    });

    it('first-match-wins on overlapping rows (S6)', () => {
        seedOutboundParams({ utm_source: 'x', tess: 'abc', session_hash: 'h1', shop_id: 'S' });
        createLink('https://shop.partner.com/page');

        handle = registerOutboundDecorator({
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

    it('does not overwrite author-placed UTM params on links (N3)', () => {
        seedOutboundParams({ utm_source: 'google', utm_medium: 'cpc' });
        createLink('https://partner.com/page?utm_source=existing');

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('existing');
        expect(url.searchParams.get('utm_medium')).toBe('cpc');
    });

    it('does not overwrite author-placed extra params on links (N3 extras)', () => {
        seedOutboundParams({ utm_source: 'google', tess: 'auto' });
        createLink('https://partner.com/page?tess=manual');

        handle = registerOutboundDecorator({
            domains: [entry('partner.com', ['tess'])],
        });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('tess')).toBe('manual');
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('ignores internal links (N2)', () => {
        seedOutboundParams({ utm_source: 'google' });
        const link = createLink('https://example.local/internal');

        handle = registerOutboundDecorator({ domains: [entry('example.local')] });

        expect(link.href).toBe('https://example.local/internal');
    });

    it('ignores links to non-configured domains (N1)', () => {
        seedOutboundParams({ utm_source: 'google' });
        const link = createLink('https://other.com/page');

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        expect(link.href).toBe('https://other.com/page');
    });

    it('does not match similar-named hostnames (no false subdomain match)', () => {
        seedOutboundParams({ utm_source: 'google' });
        const evilSuffix = createLink('https://evilpartner.com/page');
        const evilSubdomain = createLink('https://partner.evil.com/page');

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        expect(evilSuffix.href).toBe('https://evilpartner.com/page');
        expect(evilSubdomain.href).toBe('https://partner.evil.com/page');
    });

    it('matches true subdomains via dotted-suffix rule', () => {
        seedOutboundParams({ utm_source: 'google' });
        createLink('https://shop.partner.com/page');

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const url = new URL(document.querySelector('a')!.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates dynamically added links via MutationObserver', async () => {
        seedOutboundParams({ utm_source: 'google' });

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = createLink('https://partner.com/new');

        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(link.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('decorates nested links inside dynamically added container elements', async () => {
        seedOutboundParams({ utm_source: 'google' });

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const div = document.createElement('div');
        const a = document.createElement('a');
        a.href = 'https://partner.com/nested';
        div.appendChild(a);
        document.body.appendChild(div);

        await new Promise((resolve) => setTimeout(resolve, 0));

        const url = new URL(a.href);
        expect(url.searchParams.get('utm_source')).toBe('google');
    });

    it('observer path does not overwrite author-placed params on dynamically added links (S1)', async () => {
        seedOutboundParams({ utm_source: 'auto' });

        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = createLink('https://partner.com/page?utm_source=manual');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(new URL(link.href).searchParams.get('utm_source')).toBe('manual');
    });

    it('cleanup disconnects the observer', async () => {
        seedOutboundParams({ utm_source: 'google' });

        const localHandle = registerOutboundDecorator({ domains: [entry('partner.com')] });
        localHandle.cleanup();

        await new Promise((resolve) => setTimeout(resolve, 0));

        const link = createLink('https://partner.com/after-cleanup');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(link.href).toBe('https://partner.com/after-cleanup');
    });

    it('returns handle with no-op methods when no domains provided', () => {
        seedOutboundParams({ utm_source: 'google' });

        const localHandle = registerOutboundDecorator({ domains: [] });

        expect(typeof localHandle.update).toBe('function');
        expect(typeof localHandle.clear).toBe('function');
        expect(typeof localHandle.cleanup).toBe('function');
        expect(() => localHandle.update({ utm_source: 'fb' })).not.toThrow();
        expect(() => localHandle.clear()).not.toThrow();
        expect(() => localHandle.cleanup()).not.toThrow();
    });

    it('returns handle with no-op methods when domains key is absent', () => {
        seedOutboundParams({ utm_source: 'google' });

        const localHandle = registerOutboundDecorator({});

        expect(typeof localHandle.update).toBe('function');
        expect(typeof localHandle.clear).toBe('function');
        expect(typeof localHandle.cleanup).toBe('function');
        expect(() => localHandle.cleanup()).not.toThrow();
    });

    it('no-op handle update() does not write to localStorage (S4)', () => {
        const localHandle = registerOutboundDecorator({ domains: [] });

        localHandle.update({ utm_source: 'fb' });

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });

    it('no-op handle clear(keys) does not write to localStorage (S4)', () => {
        const localHandle = registerOutboundDecorator({ domains: [] });

        localHandle.update({ utm_source: 'fb' });
        localHandle.clear(['utm_source']);

        expect(localStorage.getItem('outbound_params')).toBeNull();
    });

    it('attaches observer even when storage is empty at registration', async () => {
        handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

        const link = createLink('https://partner.com/page');

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(link.href).toBe('https://partner.com/page');

        handle.update({ utm_source: 'runtime' });

        await vi.waitFor(() => {
            const url = new URL(link.href);
            expect(url.searchParams.get('utm_source')).toBe('runtime');
        });
    });

    describe('update()', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('writes runtime values to localStorage and decorates after debounce', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1' });

            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({ vid: 'v1' });
            expect(new URL(link.href).searchParams.get('vid')).toBeNull();

            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');
        });

        it('merges runtime values with existing stored params', () => {
            seedOutboundParams({ utm_source: 'google' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1' });

            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
                utm_source: 'google',
                vid: 'v1',
            });

            vi.advanceTimersByTime(260);

            const url = new URL(link.href);
            expect(url.searchParams.get('utm_source')).toBe('google');
            expect(url.searchParams.get('vid')).toBe('v1');
        });

        it('overwrites previously decorated library keys on subsequent update', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1' });
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');

            handle.update({ vid: 'v2' });
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.get('vid')).toBe('v2');
        });

        it('does not overwrite author-placed href params even via runtime update', () => {
            const link = createLink('https://partner.com/page?utm_source=manual');

            handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

            handle.update({ utm_source: 'runtime' });
            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.get('utm_source')).toBe('manual');
        });

        it('coalesces burst calls into a single debounced re-decoration', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'a' });
            vi.advanceTimersByTime(100);
            handle.update({ vid: 'b' });
            vi.advanceTimersByTime(100);
            handle.update({ vid: 'c' });

            expect(new URL(link.href).searchParams.get('vid')).toBeNull();

            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.get('vid')).toBe('c');
        });

        it('keeps in-memory state working when localStorage.setItem throws', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            expect(() => handle!.update({ vid: 'v1' })).not.toThrow();

            spy.mockRestore();

            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');
        });

        it('does not strip keys allowlisted only by a different domain rule (Issue #1)', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [
                    entry('partner.com', ['tess']),
                    entry('example.com', ['shop_id']),
                ],
            });

            link.href = 'https://partner.com/page?shop_id=foreign';

            handle.update({ tess: 'v1' });
            vi.advanceTimersByTime(260);

            const url = new URL(link.href);
            expect(url.searchParams.get('shop_id')).toBe('foreign');
            expect(url.searchParams.get('tess')).toBe('v1');
        });

        it('drops keys that are not in any domain allowlist before writing storage', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1', random_key: 'leak' });
            vi.advanceTimersByTime(260);

            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({ vid: 'v1' });
            const url = new URL(link.href);
            expect(url.searchParams.get('vid')).toBe('v1');
            expect(url.searchParams.has('random_key')).toBe(false);
        });

        it('removes a previously decorated key when update sets it to empty string (Issue #2 empty-value)', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1' });
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');

            handle.update({ vid: '' });
            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.has('vid')).toBe(false);
        });

        it('update({k:""}) removes k from localStorage outbound_params (Issue #2 storage)', () => {
            seedOutboundParams({ utm_source: 'google', vid: 'v1' });
            createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: '' });
            vi.advanceTimersByTime(260);

            const stored = JSON.parse(localStorage.getItem('outbound_params')!);
            expect(stored).toEqual({ utm_source: 'google' });
            expect(stored).not.toHaveProperty('vid');
        });

        it('update({k:""}) on the only stored key removes the storage entry entirely', () => {
            seedOutboundParams({ vid: 'v1' });

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: '' });
            vi.advanceTimersByTime(260);

            expect(localStorage.getItem('outbound_params')).toBeNull();
        });
    });

    describe('clear()', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('clear(["vid"]) removes that key from links, in-memory state, and storage', () => {
            seedOutboundParams({ utm_source: 'google', vid: 'v1' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');

            handle.clear(['vid']);
            vi.advanceTimersByTime(260);

            const url = new URL(link.href);
            expect(url.searchParams.has('vid')).toBe(false);
            expect(url.searchParams.get('utm_source')).toBe('google');
            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
                utm_source: 'google',
            });
        });

        it('clear() with no args wipes in-memory state, storage, and library-written keys on links', () => {
            seedOutboundParams({ utm_source: 'google', vid: 'v1' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.clear();
            vi.advanceTimersByTime(260);

            const url = new URL(link.href);
            expect(url.searchParams.has('utm_source')).toBe(false);
            expect(url.searchParams.has('vid')).toBe(false);
            expect(localStorage.getItem('outbound_params')).toBeNull();
        });

        it('clear() leaves author-placed params on links untouched', () => {
            seedOutboundParams({ vid: 'v1' });
            const link = createLink('https://partner.com/page?utm_source=manual');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.clear();
            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.get('utm_source')).toBe('manual');
        });

        it('clear(["toString"]) removes a prototype-named key from links (Issue #2 prototype-name)', () => {
            seedOutboundParams({ toString: 'foo' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['toString'])],
            });

            expect(new URL(link.href).searchParams.get('toString')).toBe('foo');

            handle.clear(['toString']);
            vi.advanceTimersByTime(260);

            expect(new URL(link.href).searchParams.has('toString')).toBe(false);
        });

        it('clear(keys) called before update() debounce expires still removes the key (S2)', () => {
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v1' });
            handle.clear(['vid']);
            vi.advanceTimersByTime(260);

            const stored = localStorage.getItem('outbound_params');
            expect(stored === null || !JSON.parse(stored).vid).toBe(true);
            expect(new URL(link.href).searchParams.has('vid')).toBe(false);
        });

        it('clear([]) is a no-op for storage and DOM (Issue #3)', () => {
            seedOutboundParams({ utm_source: 'google', vid: 'v1' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');
            const hrefBefore = link.href;

            handle.clear([]);
            vi.advanceTimersByTime(260);

            expect(link.href).toBe(hrefBefore);
            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
                utm_source: 'google',
                vid: 'v1',
            });
        });

        it('clear([]) triggers no setItem/removeItem and schedules no debounce timer (Issue #5)', () => {
            seedOutboundParams({ utm_source: 'google', vid: 'v1' });
            createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            vi.clearAllTimers();

            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
            const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

            handle.clear([]);

            expect(setItemSpy).not.toHaveBeenCalled();
            expect(removeItemSpy).not.toHaveBeenCalled();
            expect(setTimeoutSpy).not.toHaveBeenCalled();

            setItemSpy.mockRestore();
            removeItemSpy.mockRestore();
            setTimeoutSpy.mockRestore();
        });
    });

    describe('cleanup()', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('cancels a pending debounced re-decoration', () => {
            const link = createLink('https://partner.com/page');

            const localHandle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            localHandle.update({ vid: 'v1' });
            localHandle.cleanup();
            vi.advanceTimersByTime(500);

            expect(new URL(link.href).searchParams.has('vid')).toBe(false);
        });

        it('update() / clear() after cleanup() are no-ops', () => {
            const link = createLink('https://partner.com/page');

            const localHandle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });
            localHandle.cleanup();

            localHandle.update({ vid: 'v1' });
            vi.advanceTimersByTime(500);
            expect(new URL(link.href).searchParams.has('vid')).toBe(false);

            // localStorage was not touched by the post-cleanup update either
            expect(localStorage.getItem('outbound_params')).toBeNull();

            localHandle.clear();
            expect(localStorage.getItem('outbound_params')).toBeNull();
        });
    });

    describe('captureUrlParams() integration', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('feeds URL params through the same update pipeline as runtime callers', () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hostname: 'example.local',
                    search: '?utm_source=google&tess=abc&ignored=xx',
                },
                writable: true,
            });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['tess'])],
            });
            captureUrlParams();
            vi.advanceTimersByTime(260);

            expect(JSON.parse(localStorage.getItem('outbound_params')!)).toEqual({
                utm_source: 'google',
                tess: 'abc',
            });
            const url = new URL(link.href);
            expect(url.searchParams.get('utm_source')).toBe('google');
            expect(url.searchParams.get('tess')).toBe('abc');
            expect(url.searchParams.has('ignored')).toBe(false);
        });

        it('is a no-op when called before any decorator is registered', () => {
            Object.defineProperty(window, 'location', {
                value: { hostname: 'example.local', search: '?utm_source=google' },
                writable: true,
            });

            captureUrlParams();

            expect(localStorage.getItem('outbound_params')).toBeNull();
        });

        it('explicit empty URL value clears the stored value (Issue #3)', () => {
            seedOutboundParams({ utm_source: 'facebook' });
            Object.defineProperty(window, 'location', {
                value: { hostname: 'example.local', search: '?utm_source=' },
                writable: true,
            });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({ domains: [entry('partner.com')] });
            captureUrlParams();
            vi.advanceTimersByTime(260);

            expect(localStorage.getItem('outbound_params')).toBeNull();
            expect(new URL(link.href).searchParams.has('utm_source')).toBe(false);
        });
    });

    describe('no-op re-registration preserves the live decorator (Issue #1)', () => {
        it('does not tear down a prior decorator when re-registered with no domains', async () => {
            seedOutboundParams({ utm_source: 'google' });

            handle = registerOutboundDecorator({ domains: [entry('partner.com')] });

            const noopHandle = registerOutboundDecorator({ domains: [] });
            const noopHandleEmptyConfig = registerOutboundDecorator({});

            const link = createLink('https://partner.com/new');

            await new Promise((resolve) => setTimeout(resolve, 0));

            const url = new URL(link.href);
            expect(url.searchParams.get('utm_source')).toBe('google');

            noopHandle.cleanup();
            noopHandleEmptyConfig.cleanup();
        });
    });

    describe('storage prune on register (Issue #4 prune)', () => {
        it('removes stored keys absent from the union allowlist on register', () => {
            seedOutboundParams({ utm_source: 'google', session_id: 'abc' });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com')],
            });

            const stored = JSON.parse(localStorage.getItem('outbound_params')!);
            expect(stored).toEqual({ utm_source: 'google' });
            expect(stored).not.toHaveProperty('session_id');

            const url = new URL(link.href);
            expect(url.searchParams.has('session_id')).toBe(false);
            expect(url.searchParams.get('utm_source')).toBe('google');
        });

        it('removes the storage key entirely when prune empties the blob', () => {
            seedOutboundParams({ session_id: 'abc' });

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            expect(localStorage.getItem('outbound_params')).toBeNull();
        });
    });

    describe('prototype-key rejection (Suggestion #7)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('does not admit __proto__, constructor, or prototype into the allowlist via URL capture', () => {
            Object.defineProperty(window, 'location', {
                value: {
                    hostname: 'example.local',
                    search: '?__proto__=x&constructor=y&prototype=z&utm_source=g',
                },
                writable: true,
            });
            const link = createLink('https://partner.com/page');

            handle = registerOutboundDecorator({
                domains: [
                    entry('partner.com', ['__proto__', 'constructor', 'prototype']),
                ],
            });

            captureUrlParams();
            vi.advanceTimersByTime(260);

            const stored = JSON.parse(localStorage.getItem('outbound_params')!);
            expect(Object.prototype.hasOwnProperty.call(stored, '__proto__')).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(stored, 'constructor')).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(stored, 'prototype')).toBe(false);
            expect(stored.utm_source).toBe('g');

            const url = new URL(link.href);
            expect(url.searchParams.has('__proto__')).toBe(false);
            expect(url.searchParams.has('constructor')).toBe(false);
            expect(url.searchParams.has('prototype')).toBe(false);
            expect(url.searchParams.get('utm_source')).toBe('g');
        });
    });

    describe('re-registration (Issue #4)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('a later handle can update keys previously decorated by an earlier handle', () => {
            const link = createLink('https://partner.com/page');

            const h1 = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });
            h1.update({ vid: 'v1' });
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.get('vid')).toBe('v1');

            handle = registerOutboundDecorator({
                domains: [entry('partner.com', ['vid'])],
            });

            handle.update({ vid: 'v2' });
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.get('vid')).toBe('v2');

            handle.clear(['vid']);
            vi.advanceTimersByTime(260);
            expect(new URL(link.href).searchParams.has('vid')).toBe(false);
        });

        it('disconnects the prior observer when a new handle is registered', async () => {
            vi.useRealTimers();

            seedOutboundParams({ vid: 'v1' });

            registerOutboundDecorator({ domains: [entry('partner.com', ['vid'])] });

            handle = registerOutboundDecorator({
                domains: [entry('other.com', ['vid'])],
            });

            const partnerLink = createLink('https://partner.com/page');

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(partnerLink.href).toBe('https://partner.com/page');
        });
    });
});
