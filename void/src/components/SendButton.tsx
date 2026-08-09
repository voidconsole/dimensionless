import React, { useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Animated, {
        useSharedValue,
        useAnimatedStyle,
        withSpring,
        withSequence,
        withTiming,
        withDelay,
        withRepeat,
        Easing,
        runOnJS,
        interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { COLORS } from "../theme/index";

const SIZE = 58;
const PARTICLE_COUNT = 8;

function Particle({
        index,
        fire,
}: {
        index: number;
        fire: Animated.SharedValue<number>;
}) {
        const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
        const dist = 64 + Math.random() * 30;

        const style = useAnimatedStyle(() => ({
                opacity: interpolate(fire.value, [0, 0.3, 1], [0, 1, 0]),
                transform: [
                        { translateX: Math.cos(angle) * dist * fire.value },
                        { translateY: Math.sin(angle) * dist * fire.value },
                        {
                                scale: interpolate(
                                        fire.value,
                                        [0, 0.3, 1],
                                        [0, 1.2, 0],
                                ),
                        },
                ],
        }));

        return (
                <Animated.View
                        style={[
                                {
                                        position: "absolute",
                                        width: 4,
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor:
                                                index % 2 === 0
                                                        ? "rgba(210,226,255,0.9)"
                                                        : "rgba(255,255,255,0.5)",
                                },
                                style,
                        ]}
                />
        );
}

function Checkmark({ progress }: { progress: Animated.SharedValue<number> }) {
        const style = useAnimatedStyle(() => ({
                opacity: progress.value,
                transform: [{ scale: progress.value }],
        }));

        return (
                <Animated.View
                        style={[
                                {
                                        position: "absolute",
                                        width: 26,
                                        height: 26,
                                        alignItems: "center",
                                        justifyContent: "center",
                                },
                                style,
                        ]}
                >
                        <Feather
                                name="check"
                                size={26}
                                color={COLORS.sendActiveText}
                        />
                </Animated.View>
        );
}

interface Props {
        hasContent: boolean;
        onSend: () => void;
        disabled?: boolean;
}

export function SendButton({ hasContent, onSend, disabled }: Props) {
        const scale = useSharedValue(1);
        const ringScale = useSharedValue(1);
        const ringOpacity = useSharedValue(0);
        const bgProgress = useSharedValue(0);
        const rippleScale = useSharedValue(0);
        const rippleOpacity = useSharedValue(0);
        const fireProgress = useSharedValue(0);
        const confirmProgress = useSharedValue(0);
        const breathScale = useSharedValue(1);

        useEffect(() => {
                bgProgress.value = withTiming(hasContent ? 1 : 0, {
                        duration: 300,
                        easing: Easing.out(Easing.quad),
                });

                if (hasContent) {
                        ringOpacity.value = withTiming(1, { duration: 400 });
                        ringScale.value = withRepeat(
                                withSequence(
                                        withTiming(1.15, {
                                                duration: 1400,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                        withTiming(1, {
                                                duration: 1400,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                ),
                                -1,
                                true,
                        );
                        breathScale.value = withRepeat(
                                withSequence(
                                        withTiming(1.06, {
                                                duration: 1600,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                        withTiming(1, {
                                                duration: 1600,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                ),
                                -1,
                                true,
                        );
                } else {
                        ringOpacity.value = withTiming(0, { duration: 300 });
                        ringScale.value = 1;
                        breathScale.value = withTiming(1, { duration: 300 });
                }
        }, [hasContent]);

        const fire = () => {
                if (!hasContent || disabled) return;
                fireProgress.value = 0;
                fireProgress.value = withTiming(1, {
                        duration: 500,
                        easing: Easing.out(Easing.quad),
                });

                scale.value = withSequence(
                        withSpring(0.72, {
                                damping: 14,
                                stiffness: 600,
                                mass: 0.6,
                        }),
                        withSpring(1.25, {
                                damping: 8,
                                stiffness: 280,
                                mass: 0.7,
                        }),
                        withSpring(1, {
                                damping: 16,
                                stiffness: 320,
                                mass: 0.8,
                        }),
                );

                rippleScale.value = 0;
                rippleOpacity.value = 0.4;
                rippleScale.value = withTiming(3, {
                        duration: 650,
                        easing: Easing.out(Easing.quad),
                });
                rippleOpacity.value = withTiming(0, { duration: 650 });

                confirmProgress.value = withSequence(
                        withTiming(0, { duration: 50 }),
                        withTiming(1, {
                                duration: 400,
                                easing: Easing.out(Easing.back(2)),
                        }),
                        withDelay(600, withTiming(0, { duration: 500 })),
                );

                runOnJS(onSend)();
        };

        const btnStyle = useAnimatedStyle(() => ({
                transform: [{ scale: scale.value * breathScale.value }],
        }));

        const ringStyle = useAnimatedStyle(() => ({
                transform: [{ scale: ringScale.value }],
                opacity: ringOpacity.value,
        }));

        const bgStyle = useAnimatedStyle(() => ({
                backgroundColor:
                        bgProgress.value > 0.5
                                ? COLORS.sendActive
                                : COLORS.sendInactive,
        }));

        const rippleStyle = useAnimatedStyle(() => ({
                transform: [{ scale: rippleScale.value }],
                opacity: rippleOpacity.value,
        }));

        const glowStyle = useAnimatedStyle(() => ({
                opacity: bgProgress.value > 0.5 ? 0.6 : 0,
                transform: [{ scale: bgProgress.value > 0.5 ? 1 : 0.8 }],
        }));

        const arrowStyle = useAnimatedStyle(() => ({
                opacity: interpolate(
                        confirmProgress.value,
                        [0, 0.3, 1],
                        [1, 0.6, 0],
                ),
                transform: [
                        {
                                translateY: interpolate(
                                        confirmProgress.value,
                                        [0, 1],
                                        [0, -4],
                                ),
                        },
                        {
                                scale: interpolate(
                                        confirmProgress.value,
                                        [0, 0.5, 1],
                                        [1, 1.15, 0.7],
                                ),
                        },
                ],
        }));

        const iconInactiveStyle = useAnimatedStyle(() => ({
                opacity: bgProgress.value > 0.5 ? 0 : 1,
        }));

        const iconActiveStyle = useAnimatedStyle(() => ({
                opacity: bgProgress.value > 0.5 ? 1 : 0,
        }));

        return (
                <View style={s.wrap} pointerEvents="box-none">
                        <Animated.View
                                style={[s.glow, glowStyle]}
                                pointerEvents="none"
                        />
                        <Animated.View
                                style={[s.ring, ringStyle]}
                                pointerEvents="none"
                        />
                        <Pressable
                                onPress={fire}
                                disabled={disabled || !hasContent}
                                style={{ borderRadius: SIZE / 2 }}
                        >
                                <Animated.View
                                        style={[s.btn, bgStyle, btnStyle]}
                                >
                                        <Animated.View
                                                style={[s.ripple, rippleStyle]}
                                        />
                                        {Array.from({
                                                length: PARTICLE_COUNT,
                                        }).map((_, i) => (
                                                <Particle
                                                        key={i}
                                                        index={i}
                                                        fire={fireProgress}
                                                />
                                        ))}
                                        <Animated.View
                                                style={[s.arrow, arrowStyle]}
                                        >
                                <Animated.View
                                        style={[
                                                s.arrowLayer,
                                                iconInactiveStyle,
                                        ]}
                                >
                                        <Feather
                                                name="arrow-up"
                                                size={26}
                                                color="rgba(255,255,255,0.3)"
                                        />
                                </Animated.View>
                                <Animated.View
                                        style={[
                                                s.arrowLayer,
                                                iconActiveStyle,
                                        ]}
                                >
                                        <Feather
                                                name="arrow-up"
                                                size={26}
                                                color={COLORS.sendActiveText}
                                        />
                                </Animated.View>
                                        </Animated.View>
                                        <Checkmark
                                                progress={confirmProgress}
                                        />
                                </Animated.View>
                        </Pressable>
                </View>
        );
}

const s = StyleSheet.create({
        wrap: {
                width: SIZE + 30,
                height: SIZE + 30,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                elevation: 12,
        },
        glow: {
                position: "absolute",
                width: SIZE + 40,
                height: SIZE + 40,
                borderRadius: (SIZE + 40) / 2,
                backgroundColor: "rgba(210,226,255,0.08)",
        },
        ring: {
                position: "absolute",
                width: SIZE + 20,
                height: SIZE + 20,
                borderRadius: (SIZE + 20) / 2,
                borderWidth: 1.5,
                borderColor: "rgba(190,215,255,0.25)",
        },
        btn: {
                width: SIZE,
                height: SIZE,
                borderRadius: SIZE / 2,
                alignItems: "center",
                justifyContent: "center",
        },
        ripple: {
                position: "absolute",
                width: SIZE,
                height: SIZE,
                borderRadius: SIZE / 2,
                backgroundColor: "rgba(255,255,255,0.35)",
        },
        arrow: {
                position: "absolute",
                width: SIZE,
                height: SIZE,
                alignItems: "center",
                justifyContent: "center",
        },
        arrowLayer: {
                position: "absolute",
                width: SIZE,
                height: SIZE,
                alignItems: "center",
                justifyContent: "center",
        },
});
