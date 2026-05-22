import type {
    OutboundDomainEntry,
    OutboundDecoratorConfig,
    OutboundDecoratorHandle,
} from './types';
import { isHttpLink } from './dom-utils';
import {
    allowedParamsFor,
    buildAllowlist,
    getStoredOutboundParams,
    removeStoredOutboundParams,
    updateStoredOutboundParams,
} from './outbound-params';

type DomainRule = { entry: OutboundDomainEntry; allowed: Set<string> };

const DEBOUNCE_MS = 250;

function matchesDomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith('.' + domain);
}

function isOutboundCandidate(el: Element): el is HTMLAnchorElement {
    return isHttpLink(el) && el.hostname !== window.location.hostname;
}

function findRule(hostname: string, rules: DomainRule[]): DomainRule | null {
    return rules.find((r) => matchesDomain(hostname, r.entry.domain)) ?? null;
}

function captureAuthorKeys(link: HTMLAnchorElement): Set<string> {
    const keys = new Set<string>();
    try {
        const url = new URL(link.href);
        for (const key of url.searchParams.keys()) {
            keys.add(key);
        }
    } catch {
        // Invalid URL — treat as having no author-placed keys
    }
    return keys;
}

function decorateLink(
    link: HTMLAnchorElement,
    allowed: Set<string>,
    activeParams: Record<string, string>,
    authorOwned: WeakMap<HTMLAnchorElement, Set<string>>,
): void {
    let authorKeys = authorOwned.get(link);
    if (!authorKeys) {
        authorKeys = captureAuthorKeys(link);
        authorOwned.set(link, authorKeys);
    }

    let url: URL;
    try {
        url = new URL(link.href);
    } catch {
        return;
    }

    for (const [key, value] of Object.entries(activeParams)) {
        if (!value) continue;
        if (!allowed.has(key)) continue;
        if (authorKeys.has(key)) continue;
        url.searchParams.set(key, value);
    }

    const present = Array.from(url.searchParams.keys());
    for (const key of present) {
        if (!allowed.has(key)) continue;
        if (authorKeys.has(key)) continue;
        if (Object.hasOwn(activeParams, key) && activeParams[key] !== '') continue;
        url.searchParams.delete(key);
    }

    link.href = url.toString();
}

function decorateSubtree(
    root: Element | Document,
    rules: DomainRule[],
    activeParams: Record<string, string>,
    authorOwned: WeakMap<HTMLAnchorElement, Set<string>>,
): void {
    if (root instanceof Element && root.matches('a[href]')) {
        if (isOutboundCandidate(root)) {
            const rule = findRule(root.hostname, rules);
            if (rule) {
                decorateLink(root, rule.allowed, activeParams, authorOwned);
            }
        }
        return;
    }

    for (const link of root.querySelectorAll('a[href]')) {
        if (!isOutboundCandidate(link)) {
            continue;
        }
        const rule = findRule(link.hostname, rules);
        if (rule) {
            decorateLink(link, rule.allowed, activeParams, authorOwned);
        }
    }
}

function noopHandle(): OutboundDecoratorHandle {
    return {
        update: () => {},
        clear: () => {},
        cleanup: () => {},
    };
}

const authorOwned = new WeakMap<HTMLAnchorElement, Set<string>>();
let priorTeardown: (() => void) | null = null;
let activeCapture: (() => void) | null = null;

/**
 * Read allowlisted params from the current URL and feed them into the active
 * decorator's update pipeline. No-op when no decorator is registered.
 */
export function captureUrlParams(): void {
    activeCapture?.();
}

/**
 * Register the outbound link decorator. Returns an imperative handle that lets
 * callers push runtime-sourced param values (e.g. an identity-service result)
 * into the decoration pipeline after registration.
 */
export function registerOutboundDecorator(
    config: OutboundDecoratorConfig,
): OutboundDecoratorHandle {
    if (priorTeardown) {
        priorTeardown();
        priorTeardown = null;
    }
    activeCapture = null;

    const domains = config.domains ?? [];

    if (!domains.length) {
        return noopHandle();
    }

    const rules: DomainRule[] = domains.map((entry) => ({
        entry: { ...entry, domain: entry.domain.trim().toLowerCase() },
        allowed: allowedParamsFor(entry),
    }));
    const unionAllowed = buildAllowlist(config);

    let activeParams: Record<string, string> = getStoredOutboundParams();
    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const runDocumentPass = () => {
        decorateSubtree(document, rules, activeParams, authorOwned);
    };

    const scheduleRedecorate = () => {
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = undefined;
            if (!active) return;
            runDocumentPass();
        }, DEBOUNCE_MS);
    };

    runDocumentPass();

    const observer = new MutationObserver((mutations) => {
        if (!active) return;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }
                decorateSubtree(node as Element, rules, activeParams, authorOwned);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    const teardown = () => {
        active = false;
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
            debounceTimer = undefined;
        }
        observer.disconnect();
    };

    priorTeardown = teardown;

    const handle: OutboundDecoratorHandle = {
        update(values) {
            if (!active) return;
            const filtered: Record<string, string> = {};
            for (const [key, value] of Object.entries(values)) {
                if (unionAllowed.has(key)) {
                    filtered[key] = value;
                }
            }
            if (Object.keys(filtered).length === 0) return;
            activeParams = { ...activeParams, ...filtered };
            updateStoredOutboundParams(filtered);
            scheduleRedecorate();
        },
        clear(keys) {
            if (!active) return;
            if (Array.isArray(keys)) {
                for (const key of keys) {
                    delete activeParams[key];
                }
                removeStoredOutboundParams(keys);
            } else {
                activeParams = {};
                removeStoredOutboundParams();
            }
            scheduleRedecorate();
        },
        cleanup() {
            if (priorTeardown === teardown) {
                priorTeardown = null;
            }
            if (activeCapture === capture) {
                activeCapture = null;
            }
            teardown();
        },
    };

    const capture = () => {
        if (!active) return;
        const params = new URLSearchParams(window.location.search);
        const fromUrl: Record<string, string> = {};
        for (const key of unionAllowed) {
            const value = params.get(key);
            if (value) {
                fromUrl[key] = value;
            }
        }
        if (Object.keys(fromUrl).length === 0) return;
        handle.update(fromUrl);
    };

    activeCapture = capture;

    return handle;
}
