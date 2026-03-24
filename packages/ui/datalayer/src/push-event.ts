import type { DataLayerEvent, PushEvent } from './types.js';
import { resolveContext } from './context.js';

declare global {
    interface Window {
        dataLayer?: DataLayerEvent[];
    }
}

export const pushEvent: PushEvent = (data, element?) => {
    const context = element ? resolveContext(element) || null : null;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ...data, context });
};
