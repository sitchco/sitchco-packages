export { pushEvent } from './push-event';
export { resolveContext } from './context';
export { registerClickTracker, resolveClickPayload } from './click-tracker';
export { resolveAriaLabelledBy } from './dom-utils';
export { captureLandingParams, getStoredLandingParams } from './landing-params';
export { registerOutboundDecorator } from './outbound';
export { doEnhancedEcommerce } from './ecommerce';

export type {
    PushEvent,
    DataLayerEvent,
    ClickData,
    ClickPayload,
    ClickTrackerConfig,
    CleanupFn,
    LandingDomainEntry,
    LandingParamsConfig,
    GA4EcommerceItem,
    GA4EcommerceEvent,
} from './types';
