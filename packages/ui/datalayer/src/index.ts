export { pushEvent } from './push-event.js';
export { resolveContext } from './context.js';
export { registerClickTracker, resolveClickPayload } from './click-tracker.js';
export { resolveAriaLabelledBy } from './dom-utils.js';
export { captureUtmParams, getStoredUtmParams } from './utm.js';
export { registerOutboundDecorator } from './outbound.js';
export { doEnhancedEcommerce } from './ecommerce.js';

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
} from './types.js';

export type { UtmParams } from './utm.js';
