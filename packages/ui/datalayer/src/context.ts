import { resolveAriaLabel } from './dom-utils';

const CONTEXT_SELECTOR = '[data-gtm], [id], [aria-label], [aria-labelledby]';
function resolveAncestorContext(ancestor: Element): string | null {
    const gtm = (ancestor as HTMLElement).dataset?.gtm;
    if (gtm && gtm !== '0' && gtm !== 'false' && gtm.charAt(0) !== '{') {
        return gtm;
    }
    if (gtm) {
        return null;
    }
    const id = ancestor.id;
    if (id) {
        return id;
    }
    return resolveAriaLabel(ancestor) || null;
}

export function resolveContext(el: Element): string {
    const parts: string[] = [];
    let ancestor = el.parentElement;

    while (ancestor && ancestor !== document.documentElement) {
        if (ancestor.matches(CONTEXT_SELECTOR)) {
            const val = resolveAncestorContext(ancestor);
            if (val) {
                parts.push(val);
            }
        }
        ancestor = ancestor.parentElement;
    }

    parts.reverse();
    return parts.join(' > ');
}
