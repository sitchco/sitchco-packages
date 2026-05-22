export { pushEvent } from './push-event';
export { resolveContext } from './context';
export { registerClickTracker, resolveClickPayload } from './click-tracker';
export { resolveAriaLabelledBy } from './dom-utils';
export { captureUrlParams, registerOutboundDecorator } from './outbound';
export { doEnhancedEcommerce } from './ecommerce';

export type {
    PushEvent,
    DataLayerEvent,
    ClickData,
    ClickPayload,
    ClickTrackerConfig,
    CleanupFn,
    OutboundDecoratorHandle,
    OutboundDomainEntry,
    OutboundDecoratorConfig,
    GA4EcommerceItem,
    GA4EcommerceEvent,
} from './types';
