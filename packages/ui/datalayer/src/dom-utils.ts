export function resolveAriaLabelledBy(el: Element): string {
    const id = el.getAttribute('aria-labelledby');
    if (!id) {
        return '';
    }

    const ref = document.getElementById(id);
    return ref?.textContent?.trim() || '';
}

export function isHttpLink(el: Element): el is HTMLAnchorElement {
    return (
        el.tagName === 'A' &&
        !!(el as HTMLAnchorElement).href &&
        ((el as HTMLAnchorElement).protocol === 'http:' ||
            (el as HTMLAnchorElement).protocol === 'https:')
    );
}
