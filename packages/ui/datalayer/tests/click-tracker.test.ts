import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DataLayerEvent, PushEvent } from '../src/types';
import { registerClickTracker, resolveClickPayload } from '../src/click-tracker';

let pushed: { data: DataLayerEvent; element?: Element }[];
const mockPush: PushEvent = (data, element?) => pushed.push({ data, element });

function tick(): Promise<void> {
    return new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0))
    );
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
            click: { label: 'Buy Tickets', direction: null, url: null, expanded: null, pressed: null },
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
            click: { label: 'Menu', direction: null, url: null, expanded: true, pressed: null },
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
            click: { label: 'Buy Tickets', direction: null, url: null, expanded: null, pressed: null },
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
                expanded: null,
                pressed: null,
            },
        });

        cleanup();
    });

    // S6: Toggle interaction
    it('S6: awaits beforeResolve before reading ARIA (mutation deferred past macrotask)', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Menu';
        btn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush, {
            beforeResolve: () =>
                new Promise<void>((r) => {
                    setTimeout(() => {
                        btn.setAttribute('aria-expanded', 'true');
                        r();
                    }, 0);
                }),
        });

        click(btn);
        await tick();

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Menu', direction: null, url: null, expanded: true, pressed: null },
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
            click: { label: 'Override', direction: null, url: null, expanded: null, pressed: null, promo: 'summer' },
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
            click: { label: 'Subscribe', direction: null, url: null, expanded: null, pressed: null },
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
                expanded: null,
                pressed: null,
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
                expanded: null,
                pressed: null,
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
            click: { label: 'Contact', direction: null, url: null, expanded: null, pressed: null },
        });

        cleanup();
    });

    // A1 (covers S9): aria-expanded independent reads
    it('A1: emits expanded=true/false/null from aria-expanded; pressed defaults to null', async () => {
        const cleanup = registerClickTracker(mockPush);

        const trueBtn = document.createElement('button');
        trueBtn.textContent = 'Open';
        trueBtn.setAttribute('aria-expanded', 'true');
        document.body.appendChild(trueBtn);

        const falseBtn = document.createElement('button');
        falseBtn.textContent = 'Closed';
        falseBtn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(falseBtn);

        const invalidBtn = document.createElement('button');
        invalidBtn.textContent = 'Bad';
        invalidBtn.setAttribute('aria-expanded', 'yes');
        document.body.appendChild(invalidBtn);

        const emptyBtn = document.createElement('button');
        emptyBtn.textContent = 'Empty';
        emptyBtn.setAttribute('aria-expanded', '');
        document.body.appendChild(emptyBtn);

        click(trueBtn);
        await tick();
        click(falseBtn);
        await tick();
        click(invalidBtn);
        await tick();
        click(emptyBtn);
        await tick();

        expect(pushed[0].data).toMatchObject({ click: { expanded: true, pressed: null } });
        expect(pushed[1].data).toMatchObject({ click: { expanded: false, pressed: null } });
        expect(pushed[2].data).toMatchObject({ click: { expanded: null, pressed: null } });
        expect(pushed[3].data).toMatchObject({ click: { expanded: null, pressed: null } });

        cleanup();
    });

    // A2 (covers S10): aria-pressed independent reads, including "mixed" coercion
    it('A2: emits pressed=true/false/null from aria-pressed; "mixed" coerces to null', async () => {
        const cleanup = registerClickTracker(mockPush);

        const trueBtn = document.createElement('button');
        trueBtn.textContent = 'On';
        trueBtn.setAttribute('aria-pressed', 'true');
        document.body.appendChild(trueBtn);

        const falseBtn = document.createElement('button');
        falseBtn.textContent = 'Off';
        falseBtn.setAttribute('aria-pressed', 'false');
        document.body.appendChild(falseBtn);

        const mixedBtn = document.createElement('button');
        mixedBtn.textContent = 'Mixed';
        mixedBtn.setAttribute('aria-pressed', 'mixed');
        document.body.appendChild(mixedBtn);

        const invalidBtn = document.createElement('button');
        invalidBtn.textContent = 'Bad';
        invalidBtn.setAttribute('aria-pressed', 'maybe');
        document.body.appendChild(invalidBtn);

        click(trueBtn);
        await tick();
        click(falseBtn);
        await tick();
        click(mixedBtn);
        await tick();
        click(invalidBtn);
        await tick();

        expect(pushed[0].data).toMatchObject({ click: { expanded: null, pressed: true } });
        expect(pushed[1].data).toMatchObject({ click: { expanded: null, pressed: false } });
        expect(pushed[2].data).toMatchObject({ click: { expanded: null, pressed: null } });
        expect(pushed[3].data).toMatchObject({ click: { expanded: null, pressed: null } });

        cleanup();
    });

    // A3 (covers S9 + S10 coexistence): both attributes read independently on one element
    it('A3: aria-expanded and aria-pressed on the same element are read independently', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Both';
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-pressed', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Both', direction: null, url: null, expanded: true, pressed: false },
        });

        cleanup();
    });

    // A4 (covers S11): neither attribute present → both fields null
    it('A4: elements without ARIA state emit expanded=null and pressed=null', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Plain';
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Plain', direction: null, url: null, expanded: null, pressed: null },
        });

        cleanup();
    });

    // A5 (covers S12): data-gtm JSON cannot override base fields, but custom keys still survive
    it('A5: data-gtm JSON cannot override reserved base fields (label has a separate resolver chain)', async () => {
        const a = document.createElement('a');
        a.href = `${location.origin}/forms/`;
        a.textContent = 'Real Label';
        a.dataset.gtm = '{"label":"hijackLabel","direction":"hijackDir","url":"hijackUrl","expanded":"hijack","pressed":"hijack","customKey":"keep"}';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        // label is resolved separately via labelResolvers and accepts gtmData.label
        // (which is a string) — that path is not blocked by base-key reservation.
        // direction/url/expanded/pressed MUST come from DOM/ARIA, not data-gtm.
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: {
                label: 'hijackLabel',
                direction: 'internal',
                url: '/forms/',
                expanded: null,
                pressed: null,
                customKey: 'keep',
            },
        });

        cleanup();
    });

    // A6: default beforeResolve yields one rAF so framework-driven ARIA flips settle before reads
    it('A6: default beforeResolve yields one rAF before reading ARIA when no override is supplied', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Menu';
        btn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);

        click(btn);
        // Framework flips aria-expanded between click dispatch and the rAF callback.
        btn.setAttribute('aria-expanded', 'true');
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Menu', direction: null, url: null, expanded: true, pressed: null },
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
            click: { label: 'Buy Tickets', direction: null, url: null, expanded: null, pressed: null },
        });
        expect(pushed).toHaveLength(0); // No side effects
    });
});
