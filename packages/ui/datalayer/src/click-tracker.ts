import type {
    PushEvent,
    ClickData,
    ClickPayload,
    ClickTrackerConfig,
    CleanupFn,
} from './types';
import { isHttpLink, resolveAriaLabelledBy } from './dom-utils';

const SELECTOR = 'a, button, input[type=submit], [data-button]';
const MAX_LENGTH = 100;

function isOptedOut(el: Element): boolean {
    const val = (el as HTMLElement).dataset?.gtm;
    return val === '0' || val === 'false';
}

function parseGtmData(el: Element): Record<string, unknown> | null {
    const raw = (el as HTMLElement).dataset?.gtm;
    if (!raw || raw.charAt(0) !== '{') {
        return null;
    }

    try {
        const obj = JSON.parse(raw);
        return typeof obj === 'object' && obj !== null ? obj : null;
    } catch {
        return null;
    }
}

function truncate(text: string): string {
    if (!text) {
        return '';
    }
    return text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;
}

type LabelResolver = (
    el: Element,
    gtmData: Record<string, unknown> | null,
) => string | undefined | null;

const labelResolvers: LabelResolver[] = [
    (_el, gtmData) => typeof gtmData?.label === 'string' ? gtmData.label : undefined,
    (el) => el.getAttribute('aria-label') || undefined,
    (el) => resolveAriaLabelledBy(el) || undefined,
    (el) => el.getAttribute('title') || undefined,
    (el) => (el as HTMLInputElement).value || undefined,
    (el) => truncate(el.textContent?.trim().replace(/\s+/g, ' ') || '') || undefined,
];

function resolveLabel(
    el: Element,
    gtmData: Record<string, unknown> | null,
): string {
    for (const resolve of labelResolvers) {
        const result = resolve(el, gtmData);
        if (result) {
            return result;
        }
    }
    return '';
}

function resolveLinkProps(
    el: Element,
): { direction: 'internal' | 'outbound'; url: string } | null {
    if (!isHttpLink(el)) {
        return null;
    }

    const isOutbound = el.hostname !== location.hostname;
    return {
        direction: isOutbound ? 'outbound' : 'internal',
        url:
            (isOutbound ? el.origin : '') +
            (el.pathname + el.search + el.hash || '/'),
    };
}

function resolveToggle(el: Element): boolean | undefined {
    const expanded = el.getAttribute('aria-expanded');
    if (expanded === 'true') {
        return true;
    }
    if (expanded === 'false') {
        return false;
    }
    return undefined;
}

function buildClickData(
    el: Element,
    gtmData: Record<string, unknown> | null,
): ClickData {
    const label = resolveLabel(el, gtmData);
    const linkProps = resolveLinkProps(el);
    const toggle = resolveToggle(el);

    // Always push every known field — GTM's dataLayer uses recursive merge,
    // so omitted keys retain their previous values. Use null to clear stale data.
    const click: Record<string, unknown> = {
        label: label || null,
        direction: linkProps?.direction ?? null,
        url: linkProps?.url ?? null,
        toggle: toggle ?? null,
    };

    // Spread gtmData fields into click namespace (excluding label, already resolved)
    if (gtmData) {
        for (const [key, value] of Object.entries(gtmData)) {
            if (key !== 'label' && key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && value != null && value !== '') {
                click[key] = value;
            }
        }
    }

    return click as ClickData;
}

export function resolveClickPayload(el: Element): ClickPayload {
    const gtmData = parseGtmData(el);
    return {
        event: 'site_click',
        click: buildClickData(el, gtmData),
    };
}

export function registerClickTracker(
    pushEvent: PushEvent,
    config?: ClickTrackerConfig,
): CleanupFn {
    const handler = async (e: Event) => {
        const el = (e.target as Element)?.closest(SELECTOR);
        if (!el) {
            return;
        }

        if (isOptedOut(el)) {
            return;
        }

        try {
            if (config?.beforeResolve) {
                await config.beforeResolve(el);
            }

            // All mutable DOM reads happen after beforeResolve
            const gtmData = parseGtmData(el);
            const payload: ClickPayload = {
                event: 'site_click',
                click: buildClickData(el, gtmData),
            };

            pushEvent(payload, el);
        } catch {
            // Prevent consumer beforeResolve errors from breaking tracking
        }
    };

    document.addEventListener('click', handler);

    return () => {
        document.removeEventListener('click', handler);
    };
}
