import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DataLayerEvent, PushEvent } from '../src/types.js';
import { registerClickTracker, resolveClickPayload } from '../src/click-tracker.js';

let pushed: DataLayerEvent[];
const mockPush: PushEvent = (data) => pushed.push(data);

function tick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function click(el: Element): void {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
    pushed = [];
    document.body.innerHTML = '';
});

describe('registerClickTracker', () => {
    // S1: Registration & basic click tracking
    it('S1: registers a document click listener and pushes on trackable clicks', async () => {
        const cleanup = registerClickTracker(mockPush);

        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        btn.textContent = 'Buy Tickets';
        section.appendChild(btn);
        document.body.appendChild(section);

        click(btn);
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: { label: 'Buy Tickets', context: 'Hero' },
        });

        cleanup();
    });

    // S2: beforeResolve async hook
    it('S2: calls and awaits beforeResolve before reading DOM attributes', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Menu';
        btn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush, {
            beforeResolve: () =>
                new Promise<void>((resolve) => {
                    // Simulate framework updating aria-expanded after async delay
                    btn.setAttribute('aria-expanded', 'true');
                    resolve();
                }),
        });

        click(btn);
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: { label: 'Menu', toggle: true },
        });

        cleanup();
    });

    // S3: Cleanup removes listener
    it('S3: cleanup function removes the document click listener', async () => {
        const cleanup = registerClickTracker(mockPush);

        const btn = document.createElement('button');
        btn.textContent = 'Click me';
        document.body.appendChild(btn);

        click(btn);
        await tick();
        expect(pushed).toHaveLength(1);

        cleanup();

        click(btn);
        await tick();
        expect(pushed).toHaveLength(1); // No additional push
    });

    // S4: Simple button click
    it('S4: resolves label from textContent and context from ancestor data-gtm', async () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        btn.textContent = 'Buy Tickets';
        section.appendChild(btn);
        document.body.appendChild(section);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: { label: 'Buy Tickets', context: 'Hero' },
        });

        cleanup();
    });

    // S5: Outbound link click
    it('S5: includes direction and url for outbound links', async () => {
        const a = document.createElement('a');
        a.href = 'https://external.com/';
        a.textContent = 'Get Tickets';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: {
                label: 'Get Tickets',
                direction: 'outbound',
                url: 'https://external.com/',
            },
        });

        cleanup();
    });

    // S6: Toggle interaction
    it('S6: reads aria-expanded after beforeResolve and includes toggle', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Menu';
        btn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush, {
            beforeResolve: () =>
                new Promise<void>((resolve) => {
                    btn.setAttribute('aria-expanded', 'true');
                    resolve();
                }),
        });

        click(btn);
        await tick();

        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: { label: 'Menu', toggle: true },
        });

        cleanup();
    });

    // S7: data-gtm JSON spread
    it('S7: spreads data-gtm JSON fields into click namespace', async () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        btn.textContent = 'Promo Button';
        btn.dataset.gtm = '{"label":"Override","promo":"summer"}';
        section.appendChild(btn);
        document.body.appendChild(section);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: { label: 'Override', promo: 'summer', context: 'Hero' },
        });

        cleanup();
    });

    // S9: Consecutive clicks with different fields
    it('S9: each push has an independent click object (no stale fields)', async () => {
        const a = document.createElement('a');
        a.href = 'https://external.com/page';
        a.textContent = 'External Link';
        document.body.appendChild(a);

        const section = document.createElement('section');
        section.dataset.gtm = 'Footer';
        const btn = document.createElement('button');
        btn.textContent = 'Subscribe';
        section.appendChild(btn);
        document.body.appendChild(section);

        const cleanup = registerClickTracker(mockPush);

        click(a);
        await tick();

        click(btn);
        await tick();

        expect(pushed).toHaveLength(2);
        // First push: outbound link
        expect(pushed[0]).toMatchObject({
            click: { direction: 'outbound', url: expect.any(String) },
        });
        // Second push: button - no direction or url
        expect(pushed[1]).toEqual({
            event: 'site_click',
            click: { label: 'Subscribe', context: 'Footer' },
        });

        cleanup();
    });

    // S10: Internal link click
    it('S10: includes direction "internal" and relative url for same-host links', async () => {
        const a = document.createElement('a');
        a.href = `${location.origin}/about`;
        a.textContent = 'About Us';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0]).toEqual({
            event: 'site_click',
            click: {
                label: 'About Us',
                direction: 'internal',
                url: '/about',
            },
        });

        cleanup();
    });

    // N1: Click on non-trackable element
    it('N1: does not push for clicks on non-trackable elements', async () => {
        const div = document.createElement('div');
        div.textContent = 'Not a button';
        document.body.appendChild(div);

        const cleanup = registerClickTracker(mockPush);
        click(div);
        await tick();

        expect(pushed).toHaveLength(0);

        cleanup();
    });

    // N2: Click on opted-out element
    it('N2: does not push for elements with data-gtm="0"', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Opted Out';
        btn.dataset.gtm = '0';
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed).toHaveLength(0);

        cleanup();
    });

    it('N2: does not push for elements with data-gtm="false"', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Opted Out';
        btn.dataset.gtm = 'false';
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed).toHaveLength(0);

        cleanup();
    });

    // N3: beforeResolve not called for opted-out clicks
    it('N3: does not call beforeResolve for opted-out clicks', async () => {
        const beforeResolve = vi.fn();

        const btn = document.createElement('button');
        btn.textContent = 'Opted Out';
        btn.dataset.gtm = '0';
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush, { beforeResolve });
        click(btn);
        await tick();

        expect(beforeResolve).not.toHaveBeenCalled();
        expect(pushed).toHaveLength(0);

        cleanup();
    });
});

describe('resolveClickPayload', () => {
    // S8: Resolve payload without pushing
    it('S8: returns click payload without pushing to data layer', () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        btn.textContent = 'Buy Tickets';
        section.appendChild(btn);
        document.body.appendChild(section);

        const payload = resolveClickPayload(btn);

        expect(payload).toEqual({
            event: 'site_click',
            click: { label: 'Buy Tickets', context: 'Hero' },
        });
        expect(pushed).toHaveLength(0); // No side effects
    });
});
