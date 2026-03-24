export function resolveAriaLabelledBy(el: Element): string {
    const ids = el.getAttribute('aria-labelledby');
    if (!ids) {
        return '';
    }

    return ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(' ');
}

export function isHttpLink(el: Element): el is HTMLAnchorElement {
    return (
        el.tagName === 'A' &&
        !!(el as HTMLAnchorElement).href &&
        ((el as HTMLAnchorElement).protocol === 'http:' ||
            (el as HTMLAnchorElement).protocol === 'https:')
    );
}
