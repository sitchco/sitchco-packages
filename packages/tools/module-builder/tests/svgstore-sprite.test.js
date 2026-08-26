import { describe, it, expect } from 'vitest';
import { iconNames } from '../src/vite-plugin/svgstore-sprite.js';

describe('iconNames', () => {
    it('strips the prefix from icon symbols', () => {
        expect(iconNames(['icon-arrow', 'icon-search'])).toEqual(['arrow', 'search']);
    });

    // The symbol stays in the sprite either way — it just stops being offered as an icon.
    it('drops symbols without the prefix', () => {
        expect(iconNames(['icon-arrow', 'half-circle'])).toEqual(['arrow']);
    });

    it('strips only the leading prefix', () => {
        expect(iconNames(['icon-icon-play'])).toEqual(['icon-play']);
    });

    it('does not treat the prefix mid-name as an icon', () => {
        expect(iconNames(['brand-icon-mark'])).toEqual([]);
    });
});
