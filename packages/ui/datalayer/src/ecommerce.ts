import type { PushEvent, GA4EcommerceItem } from './types.js';

export type { GA4EcommerceItem, GA4EcommerceEvent } from './types.js';

export function doEnhancedEcommerce(
    pushEvent: PushEvent,
    event: string,
    items: GA4EcommerceItem[],
    extra?: Record<string, unknown>,
): void {
    // GA4 requires clearing ecommerce before pushing new data
    pushEvent({ event: '', ecommerce: null });
    pushEvent({
        event,
        ecommerce: {
            ...extra,
            items,
        },
    });
}
