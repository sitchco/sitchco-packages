import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAriaLabelledBy, isHttpLink } from '../src/dom-utils';

describe('resolveAriaLabelledBy', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns text content of referenced element', () => {
        const label = document.createElement('span');
        label.id = 'my-label';
        label.textContent = '  Section Title  ';
        document.body.appendChild(label);

        const el = document.createElement('button');
        el.setAttribute('aria-labelledby', 'my-label');
        document.body.appendChild(el);

        expect(resolveAriaLabelledBy(el)).toBe('Section Title');
    });

    it('returns empty string when aria-labelledby is missing', () => {
        const el = document.createElement('button');
        expect(resolveAriaLabelledBy(el)).toBe('');
    });

    it('returns empty string when referenced element does not exist', () => {
        const el = document.createElement('button');
        el.setAttribute('aria-labelledby', 'nonexistent');
        expect(resolveAriaLabelledBy(el)).toBe('');
    });

    it('joins text from multiple space-separated IDs', () => {
        const icon = document.createElement('span');
        icon.id = 'icon-label';
        icon.textContent = 'Search';
        document.body.appendChild(icon);

        const desc = document.createElement('span');
        desc.id = 'desc-label';
        desc.textContent = 'the site';
        document.body.appendChild(desc);

        const el = document.createElement('button');
        el.setAttribute('aria-labelledby', 'icon-label desc-label');
        document.body.appendChild(el);

        expect(resolveAriaLabelledBy(el)).toBe('Search the site');
    });

    it('skips missing IDs in a multi-ID list', () => {
        const label = document.createElement('span');
        label.id = 'exists';
        label.textContent = 'Hello';
        document.body.appendChild(label);

        const el = document.createElement('button');
        el.setAttribute('aria-labelledby', 'exists missing');
        document.body.appendChild(el);

        expect(resolveAriaLabelledBy(el)).toBe('Hello');
    });
});

describe('isHttpLink', () => {
    it('returns true for http link', () => {
        const a = document.createElement('a');
        a.href = 'http://example.com';
        expect(isHttpLink(a)).toBe(true);
    });

    it('returns true for https link', () => {
        const a = document.createElement('a');
        a.href = 'https://example.com';
        expect(isHttpLink(a)).toBe(true);
    });

    it('returns false for mailto link', () => {
        const a = document.createElement('a');
        a.href = 'mailto:test@example.com';
        expect(isHttpLink(a)).toBe(false);
    });

    it('returns false for tel link', () => {
        const a = document.createElement('a');
        a.href = 'tel:+1234567890';
        expect(isHttpLink(a)).toBe(false);
    });

    it('returns false for non-anchor element', () => {
        const btn = document.createElement('button');
        expect(isHttpLink(btn)).toBe(false);
    });
});
