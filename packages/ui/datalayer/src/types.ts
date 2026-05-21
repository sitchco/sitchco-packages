export type PushEvent = (data: DataLayerEvent, element?: Element) => void;

export interface DataLayerEvent {
    event?: string;
    [key: string]: unknown;
}

export interface ClickData {
    label?: string;
    direction?: 'internal' | 'outbound';
    url?: string;
    expanded?: boolean | null;
    pressed?: boolean | null;
    [key: string]: unknown;
}

export interface ClickPayload extends DataLayerEvent {
    event: 'site_click';
    click: ClickData;
}

export interface ClickTrackerConfig {
    beforeResolve?: (el: Element) => Promise<void> | void;
}

export interface LandingDomainEntry {
    domain: string;
    extraParams?: string[];
}

export interface LandingParamsConfig {
    domains?: LandingDomainEntry[];
}

export type CleanupFn = () => void;

/**
 * Imperative handle returned by `registerOutboundDecorator`. Lets callers push
 * runtime-sourced param values into the decoration pipeline after registration.
 */
export interface OutboundDecoratorHandle {
    /** Merge values into in-memory + stored params and schedule a re-decoration. */
    update: (values: Record<string, string>) => void;
    /** Remove specific keys, or wipe the whole stored blob when called with no args. */
    clear: (keys?: string[]) => void;
    /** Disconnect the observer, cancel pending debounce, and disable further updates. */
    cleanup: CleanupFn;
}

export interface GA4EcommerceItem {
    item_id: string;
    item_name: string;
    price?: number;
    quantity?: number;
    item_category?: string;
    item_brand?: string;
    [key: string]: unknown;
}

export interface GA4EcommerceEvent extends DataLayerEvent {
    ecommerce: {
        items: GA4EcommerceItem[];
        [key: string]: unknown;
    };
}
