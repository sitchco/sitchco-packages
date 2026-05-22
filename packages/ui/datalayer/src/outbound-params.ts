import type { OutboundDomainEntry, OutboundDecoratorConfig } from './types';

const UTM_DEFAULTS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
] as const;

const STORAGE_KEY = 'outbound_params';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function allowedParamsFor(entry: OutboundDomainEntry): Set<string> {
    const set = new Set<string>(UTM_DEFAULTS);
    for (const param of entry.extraParams ?? []) {
        if (TOKEN_PATTERN.test(param)) {
            set.add(param);
        }
    }
    return set;
}

export function buildAllowlist(config: OutboundDecoratorConfig): Set<string> {
    const all = new Set<string>(UTM_DEFAULTS);
    for (const entry of config.domains ?? []) {
        for (const param of allowedParamsFor(entry)) {
            all.add(param);
        }
    }
    return all;
}

export function getStoredOutboundParams(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return {};
        }
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string') {
                result[key] = value;
            }
        }
        return result;
    } catch {
        return {};
    }
}

/**
 * Merge runtime-supplied values into the stored outbound-params blob. Runtime values win on collision.
 */
export function updateStoredOutboundParams(values: Record<string, string>): void {
    const next = { ...getStoredOutboundParams(), ...values };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // localStorage unavailable (private browsing, quota exceeded)
    }
}

/**
 * Remove specific keys from the stored outbound-params blob, or wipe the entire blob when no keys are given.
 */
export function removeStoredOutboundParams(keys?: string[]): void {
    try {
        if (!keys) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        const current = getStoredOutboundParams();
        for (const key of keys) {
            delete current[key];
        }
        if (Object.keys(current).length === 0) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // localStorage unavailable (private browsing, quota exceeded)
    }
}
