
/**
 * Safe wrapper for localStorage access to avoid crashes in restricted environments (iframes).
 */
export const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem(key);
            }
            return null;
        } catch (e) {
            console.warn(`[SafeStorage] Error reading ${key}:`, e);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(key, value);
            }
        } catch (e) {
            console.warn(`[SafeStorage] Error writing ${key}:`, e);
        }
    },
    removeItem: (key: string): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem(key);
            }
        } catch (e) {
            console.warn(`[SafeStorage] Error removing ${key}:`, e);
        }
    }
};
