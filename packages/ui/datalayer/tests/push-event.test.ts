import { describe, it, expect, beforeEach } from 'vitest';
import { pushEvent } from '../src/push-event.js';

describe('pushEvent', () => {
    beforeEach(() => {
        delete window.dataLayer;
    });

    it('creates window.dataLayer if it does not exist', () => {
        expect(window.dataLayer).toBeUndefined();
        pushEvent({ event: 'test' });
        expect(window.dataLayer).toEqual([{ event: 'test' }]);
    });

    it('pushes to existing window.dataLayer', () => {
        window.dataLayer = [{ event: 'existing' }];
        pushEvent({ event: 'new' });
        expect(window.dataLayer).toEqual([{ event: 'existing' }, { event: 'new' }]);
    });

    it('pushes events with additional properties', () => {
        pushEvent({ event: 'site_click', click: { label: 'Buy' } });
        expect(window.dataLayer).toEqual([
            { event: 'site_click', click: { label: 'Buy' } },
        ]);
    });
});
