import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DataLayerEvent, PushEvent } from '../src/types';
import { registerClickTracker, resolveClickPayload } from '../src/click-tracker';

let pushed: { data: DataLayerEvent; element?: Element }[];
const mockPush: PushEvent = (data, element?) => pushed.push({ data, element });

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
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Buy Tickets', direction: null, url: null, toggle: null },
        });
        expect(pushed[0].element).toBe(btn);

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
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Menu', direction: null, url: null, toggle: true },
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

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Buy Tickets', direction: null, url: null, toggle: null },
        });
        expect(pushed[0].element).toBe(btn);

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

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: {
                label: 'Get Tickets',
                direction: 'outbound',
                url: 'https://external.com/',
                toggle: null,
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

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Menu', direction: null, url: null, toggle: true },
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

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Override', direction: null, url: null, toggle: null, promo: 'summer' },
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
        expect(pushed[0].data).toMatchObject({
            click: { direction: 'outbound', url: expect.any(String) },
        });
        // Second push: button - direction and url explicitly nulled to clear stale GTM state
        expect(pushed[1].data).toEqual({
            event: 'site_click',
            click: { label: 'Subscribe', direction: null, url: null, toggle: null },
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
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: {
                label: 'About Us',
                direction: 'internal',
                url: '/about',
                toggle: null,
            },
        });

        cleanup();
    });

    // S11: Stale custom keys from previous click are nulled
    it('S11: nulls custom data-gtm keys from previous click that are absent in the next', async () => {
        const ticketLink = document.createElement('a');
        ticketLink.href = 'https://tickets.com/hadestown';
        ticketLink.textContent = 'Buy Tickets';
        ticketLink.dataset.gtm = '{"production":"Hadestown","date":"2026-04-15","price":75}';
        document.body.appendChild(ticketLink);

        const aboutLink = document.createElement('a');
        aboutLink.href = `${location.origin}/about`;
        aboutLink.textContent = 'About Us';
        document.body.appendChild(aboutLink);

        const cleanup = registerClickTracker(mockPush);

        click(ticketLink);
        await tick();

        click(aboutLink);
        await tick();

        expect(pushed).toHaveLength(2);

        // First click: has custom fields
        expect(pushed[0].data).toMatchObject({
            click: { production: 'Hadestown', date: '2026-04-15', price: 75 },
        });

        // Second click: custom fields from first click explicitly nulled
        expect(pushed[1].data).toEqual({
            event: 'site_click',
            click: {
                label: 'About Us',
                direction: 'internal',
                url: '/about',
                toggle: null,
                production: null,
                date: null,
                price: null,
            },
        });

        cleanup();
    });

    // S12: Stale custom key nulling does not persist beyond one round
    it('S12: stops nulling custom keys after they have been cleared once', async () => {
        const ticketLink = document.createElement('a');
        ticketLink.href = 'https://tickets.com/hadestown';
        ticketLink.textContent = 'Buy Tickets';
        ticketLink.dataset.gtm = '{"production":"Hadestown"}';
        document.body.appendChild(ticketLink);

        const btn1 = document.createElement('button');
        btn1.textContent = 'About';
        document.body.appendChild(btn1);

        const btn2 = document.createElement('button');
        btn2.textContent = 'Contact';
        document.body.appendChild(btn2);

        const cleanup = registerClickTracker(mockPush);

        click(ticketLink);
        await tick();

        click(btn1);
        await tick();

        click(btn2);
        await tick();

        expect(pushed).toHaveLength(3);

        // Third click: no stale custom keys — production should not appear at all
        expect(pushed[2].data).toEqual({
            event: 'site_click',
            click: { label: 'Contact', direction: null, url: null, toggle: null },
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
            click: { label: 'Buy Tickets', direction: null, url: null, toggle: null },
        });
        expect(pushed).toHaveLength(0); // No side effects
    });
});
