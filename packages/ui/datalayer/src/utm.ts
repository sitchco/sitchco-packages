const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const STORAGE_KEY = 'utm_params';

export type UtmParams = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

export function captureUtmParams(): void {
    const params = new URLSearchParams(window.location.search);
    const current: UtmParams = {};
    let hasUtm = false;

    for (const key of UTM_PARAMS) {
        const value = params.get(key);
        if (value) {
            current[key] = value;
            hasUtm = true;
        }
    }

    if (!hasUtm) {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // localStorage unavailable (private browsing, quota exceeded)
    }
}

export function getStoredUtmParams(): Record<string, string> {
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
