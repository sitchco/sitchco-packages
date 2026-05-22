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

    // A7: plain-left-click on a same-tab anchor pushes synchronously so the event survives unload
    it('A7: skips default rAF for plain-nav anchors so the push survives full-page navigation', () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.textContent = 'External';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // No awaits: push must have happened inside the click dispatch.
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { direction: 'outbound' },
        });

        cleanup();
    });

    // A8: modifier-key / target=_blank clicks still get the default rAF (no unload race)
    it('A8: keeps default rAF for modifier-key or new-tab anchor clicks', async () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.target = '_blank';
        a.setAttribute('aria-expanded', 'false');
        a.textContent = 'External';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        // Framework flips between click dispatch and the rAF callback.
        a.setAttribute('aria-expanded', 'true');

        expect(pushed).toHaveLength(0); // not yet — rAF still pending
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            click: { expanded: true },
        });

        cleanup();
    });

    // A9: plain-left-click on a form submit button pushes synchronously (form submission unloads the page)
    it('A9: skips default rAF for plain submit-button clicks so the push survives form submission', () => {
        const form = document.createElement('form');
        form.action = '/search';
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.textContent = 'Search';
        form.appendChild(submit);
        document.body.appendChild(form);

        const cleanup = registerClickTracker(mockPush);

        submit.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // No awaits: push must have happened inside the click dispatch.
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { label: 'Search' },
        });

        cleanup();
    });

    // A10: consumer-supplied beforeResolve is also skipped on plain-nav clicks
    // (the unload race is browser-level; consumer should not have to re-derive it)
    it('A10: skips consumer beforeResolve for plain-nav anchor clicks', () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.textContent = 'External';
        document.body.appendChild(a);

        const beforeResolve = vi.fn(() => new Promise<void>(() => { /* never resolves */ }));
        const cleanup = registerClickTracker(mockPush, { beforeResolve });

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // Consumer barrier must not run for nav clicks, otherwise an htmx:afterSwap-style
        // resolver would hang forever (no swap will fire when the page is unloading).
        expect(beforeResolve).not.toHaveBeenCalled();
        expect(pushed).toHaveLength(1);

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

    // R1: non-http anchor with role=button takes async path so ARIA mutation is observed
    it('R1: mailto anchor with aria-expanded uses async path and captures post-mutation ARIA', async () => {
        const a = document.createElement('a');
        a.href = 'mailto:hello@example.com';
        a.setAttribute('role', 'button');
        a.setAttribute('aria-expanded', 'false');
        a.textContent = 'Email Us';
        document.body.appendChild(a);

        const beforeResolve = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    a.setAttribute('aria-expanded', 'true');
                    resolve();
                }),
        );
        const cleanup = registerClickTracker(mockPush, { beforeResolve });

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        // Must NOT have pushed yet — async path is in flight
        expect(pushed).toHaveLength(0);
        await tick();

        expect(beforeResolve).toHaveBeenCalledTimes(1);
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            click: {
                url: 'mailto:hello@example.com',
                direction: null,
                expanded: true,
            },
        });

        cleanup();
    });

    // R2: formtarget overrides form target — `<form target="_blank">` with `formtarget="_self"` unloads
    it('R2: submit button with formtarget="_self" overrides form target=_blank and uses sync path', () => {
        const form = document.createElement('form');
        form.action = '/search';
        form.target = '_blank';
        const submit = document.createElement('button');
        submit.type = 'submit';
        submit.formTarget = '_self';
        submit.textContent = 'Search';
        form.appendChild(submit);
        document.body.appendChild(form);

        const cleanup = registerClickTracker(mockPush);

        submit.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // Sync push: form will unload because formtarget overrides form.target
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { label: 'Search' },
        });

        cleanup();
    });

    // R3: anchor with target="_top" in top-level browsing context — sync path
    it('R3: anchor target=_top in top-level context takes sync path', () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.target = '_top';
        a.textContent = 'Top';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // jsdom default: window === window.top, so target=_top unloads
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { direction: 'outbound' },
        });

        cleanup();
    });

    // R4: case-insensitive target matching — `_SELF` (uppercase) treated as same-tab
    it('R4: anchor target=_SELF (uppercase) takes sync path', () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.target = '_SELF';
        a.textContent = 'Self';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { direction: 'outbound' },
        });

        cleanup();
    });

    // R5: in-page fragment links don't unload — async path
    it('R5: in-page hash anchor takes async path', async () => {
        const a = document.createElement('a');
        a.href = '#section';
        a.textContent = 'Jump';
        document.body.appendChild(a);

        const beforeResolve = vi.fn(() => Promise.resolve());
        const cleanup = registerClickTracker(mockPush, { beforeResolve });

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        // Async path: nothing pushed yet
        expect(pushed).toHaveLength(0);
        await tick();

        expect(beforeResolve).toHaveBeenCalledTimes(1);
        expect(pushed).toHaveLength(1);

        cleanup();
    });

    // R6: download anchors don't unload — async path
    it('R6: anchor with download attribute takes async path', async () => {
        const a = document.createElement('a');
        a.href = `${location.origin}/file.pdf`;
        a.setAttribute('download', '');
        a.textContent = 'Download';
        document.body.appendChild(a);

        const beforeResolve = vi.fn(() => Promise.resolve());
        const cleanup = registerClickTracker(mockPush, { beforeResolve });

        a.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        expect(pushed).toHaveLength(0);
        await tick();

        expect(beforeResolve).toHaveBeenCalledTimes(1);
        expect(pushed).toHaveLength(1);

        cleanup();
    });

    // R7: mailto anchor preserves href as click.url; direction is null
    it('R7: mailto anchor emits click.url=href and direction=null', async () => {
        const a = document.createElement('a');
        a.href = 'mailto:hello@example.com';
        a.textContent = 'Email Us';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: {
                label: 'Email Us',
                direction: null,
                url: 'mailto:hello@example.com',
                expanded: null,
                pressed: null,
            },
        });

        cleanup();
    });

    // R7b: tel: anchor preserves href as click.url; direction null
    it('R7b: tel: anchor emits click.url=href and direction=null', async () => {
        const a = document.createElement('a');
        a.href = 'tel:+15551234567';
        a.textContent = 'Call';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        expect(pushed[0].data).toMatchObject({
            click: {
                direction: null,
                url: 'tel:+15551234567',
            },
        });

        cleanup();
    });

    // R7c: javascript: anchor preserves href as click.url; direction null
    it('R7c: javascript: anchor emits click.url=href and direction=null', async () => {
        const a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.textContent = 'JS';
        document.body.appendChild(a);

        const cleanup = registerClickTracker(mockPush);
        click(a);
        await tick();

        expect(pushed[0].data).toMatchObject({
            click: {
                direction: null,
                url: 'javascript:void(0)',
            },
        });

        cleanup();
    });

    // R8: throwing beforeResolve must NOT suppress the site_click push
    it('R8: site_click is still pushed when beforeResolve throws', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Toggle';
        btn.setAttribute('aria-expanded', 'false');
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush, {
            beforeResolve: () => {
                throw new Error('boom');
            },
        });

        click(btn);
        await tick();

        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toEqual({
            event: 'site_click',
            click: { label: 'Toggle', direction: null, url: null, expanded: false, pressed: null },
        });

        cleanup();
    });

    // R9: stale `toString` key from previous click is nulled (Object.hasOwn vs `in` operator)
    it('R9: stale data-gtm custom key "toString" is nulled on next click', async () => {
        const btn1 = document.createElement('button');
        btn1.textContent = 'First';
        btn1.dataset.gtm = '{"toString":"x"}';
        document.body.appendChild(btn1);

        const btn2 = document.createElement('button');
        btn2.textContent = 'Second';
        document.body.appendChild(btn2);

        const cleanup = registerClickTracker(mockPush);

        click(btn1);
        await tick();
        click(btn2);
        await tick();

        expect(pushed).toHaveLength(2);
        expect(pushed[0].data).toMatchObject({
            click: { toString: 'x' },
        });
        // Second click: toString stale-nulled — would not happen with `in` operator
        // because 'toString' walks the prototype chain.
        expect(pushed[1].data).toEqual({
            event: 'site_click',
            click: {
                label: 'Second',
                direction: null,
                url: null,
                expanded: null,
                pressed: null,
                toString: null,
            },
        });

        cleanup();
    });

    // R10: prototype-key names in data-gtm are rejected from spread (isReservedClickKey gate)
    it('R10: data-gtm prototype keys (__proto__, constructor, prototype) are not spread', async () => {
        const btn = document.createElement('button');
        btn.textContent = 'Hostile';
        btn.dataset.gtm =
            '{"__proto__":"polluted","constructor":"polluted","prototype":"polluted","ok":"yes"}';
        document.body.appendChild(btn);

        const cleanup = registerClickTracker(mockPush);
        click(btn);
        await tick();

        expect(pushed).toHaveLength(1);
        const clickData = (pushed[0].data as { click: Record<string, unknown> }).click;
        expect(Object.hasOwn(clickData, '__proto__')).toBe(false);
        expect(Object.hasOwn(clickData, 'constructor')).toBe(false);
        expect(Object.hasOwn(clickData, 'prototype')).toBe(false);
        expect(clickData.ok).toBe('yes');

        cleanup();
    });

    // R11: modifier-key clicks on a same-tab anchor still use the async path
    it('R11: modifier-key clicks on same-tab anchor run beforeResolve (async path)', async () => {
        const a = document.createElement('a');
        a.href = 'https://external.example.com/';
        a.textContent = 'External';
        document.body.appendChild(a);

        const beforeResolve = vi.fn(() => Promise.resolve());
        const cleanup = registerClickTracker(mockPush, { beforeResolve });

        a.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, metaKey: true }),
        );
        a.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true }),
        );
        a.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, shiftKey: true }),
        );
        a.dispatchEvent(
            new MouseEvent('click', { bubbles: true, button: 0, altKey: true }),
        );

        expect(pushed).toHaveLength(0);
        await tick();

        expect(beforeResolve).toHaveBeenCalledTimes(4);
        expect(pushed).toHaveLength(4);

        cleanup();
    });

    // R12: <input type="submit"> sync path mirrors <button type="submit">
    it('R12: skips default rAF for plain <input type=submit> clicks', () => {
        const form = document.createElement('form');
        form.action = '/search';
        const submit = document.createElement('input');
        submit.type = 'submit';
        submit.value = 'Search';
        form.appendChild(submit);
        document.body.appendChild(form);

        const cleanup = registerClickTracker(mockPush);

        submit.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

        // No awaits: push must have happened inside dispatch (sync path)
        expect(pushed).toHaveLength(1);
        expect(pushed[0].data).toMatchObject({
            event: 'site_click',
            click: { label: 'Search' },
        });

        cleanup();
    });

    // R13: resolveAriaBool boundary cases — strict matching only
    it('R13: aria-expanded only matches exact "true"/"false"; variants → null', async () => {
        const cleanup = registerClickTracker(mockPush);

        const variants = ['True', 'TRUE', ' true ', '1'];
        const btns: HTMLButtonElement[] = [];
        for (const v of variants) {
            const btn = document.createElement('button');
            btn.textContent = `v-${v}`;
            btn.setAttribute('aria-expanded', v);
            document.body.appendChild(btn);
            btns.push(btn);
        }

        for (const btn of btns) {
            click(btn);
            await tick();
        }

        expect(pushed).toHaveLength(variants.length);
        for (let i = 0; i < variants.length; i++) {
            expect(pushed[i].data).toMatchObject({
                click: { expanded: null },
            });
        }

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
