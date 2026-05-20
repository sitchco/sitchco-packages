import type { LandingDomainEntry, LandingParamsConfig, CleanupFn } from './types';
import { isHttpLink } from './dom-utils';
import { allowedParamsFor, getStoredLandingParams } from './landing-params';

type DomainRule = { entry: LandingDomainEntry; allowed: Set<string> };

function matchesDomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith('.' + domain);
}

function isOutboundCandidate(el: Element): el is HTMLAnchorElement {
    return isHttpLink(el) && el.hostname !== window.location.hostname;
}

function findRule(hostname: string, rules: DomainRule[]): DomainRule | null {
    return rules.find((r) => matchesDomain(hostname, r.entry.domain)) ?? null;
}

function decorateLink(
    link: HTMLAnchorElement,
    allowed: Set<string>,
    storedParams: Record<string, string>,
): void {
    try {
        const url = new URL(link.href);

        for (const [key, value] of Object.entries(storedParams)) {
            if (!value) continue;
            if (allowed.has(key) && !url.searchParams.has(key)) {
                url.searchParams.set(key, value);
            }
        }

        link.href = url.toString();
    } catch {
        // Invalid URL
    }
}

function decorateSubtree(
    root: Element | Document,
    rules: DomainRule[],
    storedParams: Record<string, string>,
): void {
    if (root instanceof Element && root.matches('a[href]')) {
        if (isOutboundCandidate(root)) {
            const rule = findRule(root.hostname, rules);
            if (rule) {
                decorateLink(root, rule.allowed, storedParams);
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
            decorateLink(link, rule.allowed, storedParams);
        }
    }
}

export function registerOutboundDecorator(config: LandingParamsConfig): CleanupFn {
    const domains = config.domains ?? [];
    const noop: CleanupFn = () => {};

    if (!domains.length) {
        return noop;
    }

    const storedParams = getStoredLandingParams();
    if (!Object.keys(storedParams).length) {
        return noop;
    }

    const rules: DomainRule[] = domains.map((entry) => ({
        entry,
        allowed: allowedParamsFor(entry),
    }));

    decorateSubtree(document, rules, storedParams);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }
                decorateSubtree(node as Element, rules, storedParams);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    return () => {
        observer.disconnect();
    };
}
