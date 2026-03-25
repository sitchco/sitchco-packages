import type { OutboundDecoratorConfig, CleanupFn } from './types';
import { isHttpLink } from './dom-utils';
import { getStoredUtmParams } from './utm';

function matchesDomain(hostname: string, domain: string): boolean {
    return hostname === domain || hostname.endsWith('.' + domain);
}

function isOutboundLink(link: Element, domains: string[]): link is HTMLAnchorElement {
    if (!isHttpLink(link)) {
        return false;
    }
    if (link.hostname === window.location.hostname) {
        return false;
    }
    return domains.some((domain) => matchesDomain(link.hostname, domain));
}

function decorateLink(link: HTMLAnchorElement, utmParams: Record<string, string>): void {
    try {
        const url = new URL(link.href);

        for (const [key, value] of Object.entries(utmParams)) {
            if (!url.searchParams.has(key)) {
                url.searchParams.set(key, value);
            }
        }

        link.href = url.toString();
    } catch {
        // Invalid URL
    }
}

function decorateMatchingLinks(
    root: ParentNode,
    domains: string[],
    utmParams: Record<string, string>,
): void {
    const links = root.querySelectorAll('a[href]');

    for (const link of links) {
        if (isOutboundLink(link, domains)) {
            decorateLink(link, utmParams);
        }
    }
}

export function registerOutboundDecorator(config: OutboundDecoratorConfig): CleanupFn {
    const { domains } = config;
    const normalizedDomains = domains.map(d => d.trim().toLowerCase());
    const noop: CleanupFn = () => {};

    if (!normalizedDomains.length) {
        return noop;
    }

    const utmParams = getStoredUtmParams();
    if (!Object.keys(utmParams).length) {
        return noop;
    }

    decorateMatchingLinks(document, normalizedDomains, utmParams);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }
                const el = node as Element;
                if (el.tagName === 'A' && isOutboundLink(el, normalizedDomains)) {
                    decorateLink(el, utmParams);
                } else {
                    decorateMatchingLinks(el, normalizedDomains, utmParams);
                }
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
