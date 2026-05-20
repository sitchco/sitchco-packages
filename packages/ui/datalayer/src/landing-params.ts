import type { LandingDomainEntry, LandingParamsConfig } from './types';

const UTM_DEFAULTS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
] as const;

const STORAGE_KEY = 'landing_params';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export function allowedParamsFor(entry: LandingDomainEntry): Set<string> {
    const set = new Set<string>(UTM_DEFAULTS);
    for (const param of entry.extraParams ?? []) {
        if (TOKEN_PATTERN.test(param)) {
            set.add(param);
        }
    }
    return set;
}

function buildAllowlist(config: LandingParamsConfig): Set<string> {
    const all = new Set<string>(UTM_DEFAULTS);
    for (const entry of config.domains ?? []) {
        for (const param of allowedParamsFor(entry)) {
            all.add(param);
        }
    }
    return all;
}

export function captureLandingParams(config: LandingParamsConfig): void {
    const params = new URLSearchParams(window.location.search);
    const allowlist = buildAllowlist(config);
    const current: Record<string, string> = {};
    let hasParam = false;

    for (const key of allowlist) {
        const value = params.get(key);
        if (value) {
            current[key] = value;
            hasParam = true;
        }
    }

    if (!hasParam) {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // localStorage unavailable (private browsing, quota exceeded)
    }
}

export function getStoredLandingParams(): Record<string, string> {
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
