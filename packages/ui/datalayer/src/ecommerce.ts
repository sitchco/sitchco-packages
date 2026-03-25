import type { PushEvent, GA4EcommerceItem } from './types';

export type { GA4EcommerceItem, GA4EcommerceEvent } from './types';

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
