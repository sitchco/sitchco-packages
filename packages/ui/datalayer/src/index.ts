export { pushEvent } from './push-event';
export { resolveContext } from './context';
export { registerClickTracker, resolveClickPayload } from './click-tracker';
export { resolveAriaLabelledBy } from './dom-utils';
export { captureUtmParams, getStoredUtmParams } from './utm';
export { registerOutboundDecorator } from './outbound';
export { doEnhancedEcommerce } from './ecommerce';

export type {
    PushEvent,
    DataLayerEvent,
    ClickData,
    ClickPayload,
    ClickTrackerConfig,
    CleanupFn,
    OutboundDecoratorConfig,
    GA4EcommerceItem,
    GA4EcommerceEvent,
} from './types';

export type { UtmParams } from './utm';
