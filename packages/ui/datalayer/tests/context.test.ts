import { describe, it, expect, beforeEach } from 'vitest';
import { resolveContext } from '../src/context';

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('resolveContext', () => {
    it('returns ancestor data-gtm string as context', () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        expect(resolveContext(btn)).toBe('Hero');
    });

    it('returns ancestor id when no data-gtm', () => {
        const section = document.createElement('section');
        section.id = 'main-nav';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        expect(resolveContext(btn)).toBe('main-nav');
    });

    it('returns ancestor aria-label when no data-gtm or id', () => {
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Primary');
        const btn = document.createElement('button');
        nav.appendChild(btn);
        document.body.appendChild(nav);

        expect(resolveContext(btn)).toBe('Primary');
    });

    it('returns ancestor aria-labelledby resolved text', () => {
        const label = document.createElement('span');
        label.id = 'nav-label';
        label.textContent = 'Site Navigation';
        document.body.appendChild(label);

        const nav = document.createElement('nav');
        nav.setAttribute('aria-labelledby', 'nav-label');
        const btn = document.createElement('button');
        nav.appendChild(btn);
        document.body.appendChild(nav);

        expect(resolveContext(btn)).toBe('Site Navigation');
    });

    it('builds breadcrumb from multiple ancestors in document order', () => {
        const outer = document.createElement('section');
        outer.id = 'page';
        const inner = document.createElement('div');
        inner.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        inner.appendChild(btn);
        outer.appendChild(inner);
        document.body.appendChild(outer);

        expect(resolveContext(btn)).toBe('page > Hero');
    });

    it('skips ancestors with data-gtm="0"', () => {
        const section = document.createElement('section');
        section.dataset.gtm = '0';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        expect(resolveContext(btn)).toBe('');
    });

    it('skips ancestors with data-gtm="false"', () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'false';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        expect(resolveContext(btn)).toBe('');
    });

    it('skips ancestors with JSON data-gtm', () => {
        const section = document.createElement('section');
        section.dataset.gtm = '{"label":"test"}';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        expect(resolveContext(btn)).toBe('');
    });

    it('returns empty string when no contextual ancestors exist', () => {
        const btn = document.createElement('button');
        document.body.appendChild(btn);

        expect(resolveContext(btn)).toBe('');
    });

    it('preserves full context without truncation', () => {
        let current = document.body;
        const depth = 10;
        for (let i = 0; i < depth; i++) {
            const div = document.createElement('div');
            div.id = `segment-${String(i).padStart(10, '0')}`;
            current.appendChild(div);
            current = div;
        }
        const btn = document.createElement('button');
        current.appendChild(btn);

        const result = resolveContext(btn);
        expect(result).toBe(
            Array.from({ length: depth }, (_, i) => `segment-${String(i).padStart(10, '0')}`).join(' > '),
        );
    });
});
