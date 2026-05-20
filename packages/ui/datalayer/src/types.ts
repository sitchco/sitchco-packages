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
