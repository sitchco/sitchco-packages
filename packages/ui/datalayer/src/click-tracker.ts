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
// Blocks data-gtm spread overrides AND filters stale custom keys. Note: `label` is read first by resolveLabel's chain, so it is only partially reserved.
const BASE_CLICK_KEYS = new Set(['label', 'direction', 'url', 'expanded', 'pressed']);
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Default barrier: yield one rAF so framework-driven ARIA flips settle before the tracker reads.
const defaultBeforeResolve = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => resolve()));

function isReservedClickKey(key: string): boolean {
    return BASE_CLICK_KEYS.has(key) || PROTOTYPE_KEYS.has(key);
}

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

function resolveAriaBool(el: Element, attr: string): boolean | null {
    const value = el.getAttribute(attr);
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return null;
}

function buildClickData(
    el: Element,
    gtmData: Record<string, unknown> | null,
): ClickData {
    const label = resolveLabel(el, gtmData);
    const linkProps = resolveLinkProps(el);
    const expanded = resolveAriaBool(el, 'aria-expanded');
    const pressed = resolveAriaBool(el, 'aria-pressed');

    // Always emit base keys so GTM's recursive merge sees the current value.
    const click: Record<string, unknown> = {
        label: label || null,
        direction: linkProps?.direction ?? null,
        url: linkProps?.url ?? null,
        expanded,
        pressed,
    };

    if (gtmData) {
        for (const [key, value] of Object.entries(gtmData)) {
            if (!isReservedClickKey(key) && value != null && value !== '') {
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
    let previousCustomKeys: string[] = [];

    const handler = async (e: Event) => {
        const el = (e.target as Element)?.closest(SELECTOR);
        if (!el) {
            return;
        }

        if (isOptedOut(el)) {
            return;
        }

        try {
            await (config?.beforeResolve ?? defaultBeforeResolve)(el);

            // All mutable DOM reads happen after beforeResolve
            const gtmData = parseGtmData(el);
            const click = buildClickData(el, gtmData);
            const currentCustomKeys = Object.keys(click).filter(k => !BASE_CLICK_KEYS.has(k));

            // Null out stale custom keys from the previous click
            for (const key of previousCustomKeys) {
                if (!(key in click)) {
                    click[key] = null;
                }
            }
            previousCustomKeys = currentCustomKeys;

            pushEvent({ event: 'site_click', click } as ClickPayload, el);
        } catch {
            // Prevent consumer beforeResolve errors from breaking tracking
        }
    };

    document.addEventListener('click', handler);

    return () => {
        document.removeEventListener('click', handler);
    };
}
