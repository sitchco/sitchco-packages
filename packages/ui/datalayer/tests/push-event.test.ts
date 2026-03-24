import { describe, it, expect, beforeEach } from 'vitest';
import { pushEvent } from '../src/push-event.js';

describe('pushEvent', () => {
    beforeEach(() => {
        delete window.dataLayer;
    });

    it('creates window.dataLayer if it does not exist', () => {
        expect(window.dataLayer).toBeUndefined();
        pushEvent({ event: 'test' });
        expect(window.dataLayer).toEqual([{ event: 'test', context: null }]);
    });

    it('pushes to existing window.dataLayer', () => {
        window.dataLayer = [{ event: 'existing' }];
        pushEvent({ event: 'new' });
        expect(window.dataLayer).toEqual([{ event: 'existing' }, { event: 'new', context: null }]);
    });

    it('pushes events with additional properties', () => {
        pushEvent({ event: 'site_click', click: { label: 'Buy' } });
        expect(window.dataLayer).toEqual([
            { event: 'site_click', click: { label: 'Buy' }, context: null },
        ]);
    });

    it('adds context: null when no element is provided', () => {
        pushEvent({ event: 'test' });
        expect(window.dataLayer![0]).toHaveProperty('context', null);
    });

    it('resolves context from element ancestors and adds to payload', () => {
        const section = document.createElement('section');
        section.dataset.gtm = 'Hero';
        const btn = document.createElement('button');
        section.appendChild(btn);
        document.body.appendChild(section);

        pushEvent({ event: 'test' }, btn);
        expect(window.dataLayer).toEqual([{ event: 'test', context: 'Hero' }]);

        document.body.innerHTML = '';
    });

    it('adds context: null when element has no contextual ancestors', () => {
        const btn = document.createElement('button');
        document.body.appendChild(btn);

        pushEvent({ event: 'test' }, btn);
        expect(window.dataLayer).toEqual([{ event: 'test', context: null }]);

        document.body.innerHTML = '';
    });
});
