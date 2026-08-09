// src/storage/mmkv.web.ts
// Browser (localStorage) replacement for react-native-mmkv, wired up via a
// Metro resolver alias so the app runs unmodified on the web.

const hasLocalStorage = () => {
        try {
                return typeof window !== "undefined" && !!window.localStorage;
        } catch {
                return false;
        }
};

export class MMKV {
        private prefix: string;

        constructor({ id }: { id: string }) {
                this.prefix = `mmkv:${id}:`;
        }

        private fullKey(key: string): string {
                return `${this.prefix}${key}`;
        }

        getString(key: string): string | undefined {
                if (!hasLocalStorage()) return undefined;
                const v = window.localStorage.getItem(this.fullKey(key));
                return v == null ? undefined : v;
        }

        set(key: string, value: string | number | boolean): void {
                if (!hasLocalStorage()) return;
                window.localStorage.setItem(this.fullKey(key), String(value));
        }

        delete(key: string): void {
                if (!hasLocalStorage()) return;
                window.localStorage.removeItem(this.fullKey(key));
        }

        contains(key: string): boolean {
                return this.getString(key) !== undefined;
        }

        getAllKeys(): string[] {
                if (!hasLocalStorage()) return [];
                const keys: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                        const k = window.localStorage.key(i);
                        if (k && k.startsWith(this.prefix)) {
                                keys.push(k.slice(this.prefix.length));
                        }
                }
                return keys;
        }

        clearAll(): void {
                if (!hasLocalStorage()) return;
                for (const k of this.getAllKeys()) {
                        window.localStorage.removeItem(this.fullKey(k));
                }
        }
}

export default { MMKV };
