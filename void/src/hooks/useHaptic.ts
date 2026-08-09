// src/hooks/useHaptic.ts
import { Platform } from "react-native";
import { useCallback } from "react";

let Haptics: any = null;
if (Platform.OS !== "web") {
        try {
                Haptics = require("expo-haptics");
        } catch {
                Haptics = null;
        }
}

function run(fn: keyof typeof Haptics, ...args: any[]): void {
        if (!Haptics) return;
        try {
                (Haptics as any)[fn](...args);
        } catch {
                // haptics are optional polish
        }
}

export function useHaptic() {
        const light = useCallback(
                () => run("impactAsync", Haptics?.ImpactFeedbackStyle.Light),
                [],
        );
        const medium = useCallback(
                () => run("impactAsync", Haptics?.ImpactFeedbackStyle.Medium),
                [],
        );
        const heavy = useCallback(
                () => run("impactAsync", Haptics?.ImpactFeedbackStyle.Heavy),
                [],
        );
        const success = useCallback(
                () =>
                        run(
                                "notificationAsync",
                                Haptics?.NotificationFeedbackType.Success,
                        ),
                [],
        );
        const error = useCallback(
                () =>
                        run(
                                "notificationAsync",
                                Haptics?.NotificationFeedbackType.Error,
                        ),
                [],
        );

        const sendPulse = useCallback(() => {
                if (!Haptics) return;
                run("impactAsync", Haptics.ImpactFeedbackStyle.Light);
                setTimeout(
                        () =>
                                run(
                                        "impactAsync",
                                        Haptics.ImpactFeedbackStyle.Heavy,
                                ),
                        55,
                );
                setTimeout(
                        () =>
                                run(
                                        "impactAsync",
                                        Haptics.ImpactFeedbackStyle.Light,
                                ),
                        130,
                );
        }, []);

        return { light, medium, heavy, success, error, sendPulse };
}
