import type { DataLayerEvent, PushEvent } from './types.js';

declare global {
    interface Window {
        dataLayer?: DataLayerEvent[];
    }
}

export const pushEvent: PushEvent = (data) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
};
