// src/services/secureStore.ts
// expo-secure-store does not exist on web; fall back to localStorage there.

import { Platform } from "react-native";

let SecureStore: any = null;
if (Platform.OS !== "web") {
        try {
                SecureStore = require("expo-secure-store");
        } catch {
                SecureStore = null;
        }
}

export async function getItemAsync(key: string): Promise<string | null> {
        if (!SecureStore) {
                try {
                        return window.localStorage.getItem(`void:${key}`);
                } catch {
                        return null;
                }
        }
        return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
        if (!SecureStore) {
                try {
                        window.localStorage.setItem(`void:${key}`, value);
                } catch {
                        // storage unavailable
                }
                return;
        }
        return SecureStore.setItemAsync(key, value);
}
