import { describe, it, expect, beforeEach } from 'vitest';
import { doEnhancedEcommerce } from '../src/ecommerce.js';
import type { GA4EcommerceItem } from '../src/types.js';

describe('doEnhancedEcommerce', () => {
    let pushed: any[];
    const mockPush = (data: any) => pushed.push(data);

    beforeEach(() => {
        pushed = [];
    });

    it('pushes clear event before ecommerce data', () => {
        const items: GA4EcommerceItem[] = [{ item_id: '123', item_name: 'Widget' }];

        doEnhancedEcommerce(mockPush, 'view_item', items);

        expect(pushed[0]).toEqual({ event: '', ecommerce: null });
    });

    it('pushes ecommerce event with items', () => {
        const items: GA4EcommerceItem[] = [
            { item_id: '123', item_name: 'Widget', price: 9.99, quantity: 1 },
        ];

        doEnhancedEcommerce(mockPush, 'add_to_cart', items);

        expect(pushed[1]).toEqual({
            event: 'add_to_cart',
            ecommerce: {
                items: [{ item_id: '123', item_name: 'Widget', price: 9.99, quantity: 1 }],
            },
        });
    });

    it('includes extra fields in ecommerce object', () => {
        const items: GA4EcommerceItem[] = [{ item_id: '456', item_name: 'Gadget' }];

        doEnhancedEcommerce(mockPush, 'purchase', items, {
            transaction_id: 'T-001',
            value: 29.99,
            currency: 'USD',
        });

        expect(pushed[1]).toEqual({
            event: 'purchase',
            ecommerce: {
                items: [{ item_id: '456', item_name: 'Gadget' }],
                transaction_id: 'T-001',
                value: 29.99,
                currency: 'USD',
            },
        });
    });

    it('handles empty items array', () => {
        doEnhancedEcommerce(mockPush, 'view_item_list', []);

        expect(pushed).toHaveLength(2);
        expect(pushed[0]).toEqual({ event: '', ecommerce: null });
        expect(pushed[1]).toEqual({
            event: 'view_item_list',
            ecommerce: { items: [] },
        });
    });
});
