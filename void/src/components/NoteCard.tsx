import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import Markdown from "react-native-markdown-display";
import Animated, {
        useSharedValue,
        useAnimatedStyle,
        withSpring,
        withTiming,
        withRepeat,
        withSequence,
        runOnJS,
        Easing,
        interpolate,
        FadeInDown,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { COLORS, FONTS, SPRING } from "../theme/index";
import { useLabelStore } from "../store/useLabelStore";
import { stripAttachmentTokens } from "../services/github";
import type { VoidNote } from "../services/github";
import dayjs from "dayjs";

interface Props {
        note: VoidNote;
        index: number;
        onDelete?: (id: string) => void;
}

const DELETE_THRESHOLD = -80;

type IconName = React.ComponentProps<typeof Feather>["name"];

function attIconName(type: string): IconName {
        switch (type) {
                case "image":
                        return "image";
                case "voice":
                        return "mic";
                case "video":
                        return "video";
                default:
                        return "file-text";
        }
}

export function NoteCard({ note, index, onDelete }: Props) {
        const { getCategoryColor } = useLabelStore();
        const labels = note.labels ?? [];
        const primaryLabel = labels[0] ?? "";
        const catColor = primaryLabel
                ? getCategoryColor(primaryLabel)
                : "#888888";
        const tx = useSharedValue(0);
        const opacity = useSharedValue(1);
        const deleteProgress = useSharedValue(0);
        const syncPulse = useSharedValue(1);

        useEffect(() => {
                if (note.synced) {
                        syncPulse.value = withRepeat(
                                withSequence(
                                        withTiming(0.4, {
                                                duration: 2000,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                        withTiming(1, {
                                                duration: 2000,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                ),
                                -1,
                                true,
                        );
                } else {
                        syncPulse.value = withRepeat(
                                withSequence(
                                        withTiming(0.2, {
                                                duration: 1000,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                        withTiming(1, {
                                                duration: 1000,
                                                easing: Easing.inOut(
                                                        Easing.sin,
                                                ),
                                        }),
                                ),
                                -1,
                                true,
                        );
                }
        }, [note.synced]);

        const pan = Gesture.Pan()
                .activeOffsetX([-12, 12])
                .onUpdate((e) => {
                        if (e.translationX < 0) {
                                tx.value = e.translationX;
                                deleteProgress.value = Math.min(
                                        Math.abs(e.translationX) /
                                                Math.abs(DELETE_THRESHOLD),
                                        1,
                                );
                        }
                })
                .onEnd((e) => {
                        if (e.translationX < DELETE_THRESHOLD && onDelete) {
                                tx.value = withTiming(-420, {
                                        duration: 300,
                                        easing: Easing.out(Easing.quad),
                                });
                                opacity.value = withTiming(0, {
                                        duration: 300,
                                });
                                runOnJS(onDelete)(note.id);
                        } else {
                                tx.value = withSpring(0, {
                                        ...SPRING.snappy,
                                        velocity: e.velocityX,
                                });
                                deleteProgress.value = withTiming(0, {
                                        duration: 200,
                                });
                        }
                });

        const cardStyle = useAnimatedStyle(() => ({
                transform: [{ translateX: tx.value }],
                opacity: opacity.value,
        }));

        const deleteHintStyle = useAnimatedStyle(() => ({
                opacity: interpolate(
                        deleteProgress.value,
                        [0, 0.5, 1],
                        [0, 0.3, 0.7],
                ),
                transform: [
                        {
                                scale: interpolate(
                                        deleteProgress.value,
                                        [0, 0.5, 1],
                                        [0.5, 1, 1],
                                ),
                        },
                ],
        }));

        const syncDotStyle = useAnimatedStyle(() => ({
                opacity: syncPulse.value,
                transform: [
                        {
                                scale: interpolate(
                                        syncPulse.value,
                                        [0, 0.5, 1],
                                        [0.5, 1, 0.8],
                                ),
                        },
                ],
        }));

        const clean = stripAttachmentTokens(note.text).trim();
        const preview = clean.slice(0, 240);
        const formattedDate = dayjs(note.createdAt).format("MMM D · h:mma");
        const extraLabels = Math.max(0, labels.length - 3);

        const openIssue = () => {
                if (note.issueUrl) {
                        Linking.openURL(note.issueUrl).catch(() => {});
                }
        };

        return (
                <GestureDetector gesture={pan}>
                        <View>
                                <Animated.View
                                        style={[s.deleteHint, deleteHintStyle]}
                                >
                                        <Feather
                                                name="trash-2"
                                                size={14}
                                                color="rgba(240,80,80,0.5)"
                                        />
                                        <Text style={s.deleteHintText}>
                                                delete
                                        </Text>
                                </Animated.View>
                                <Animated.View
                                        entering={FadeInDown.delay(
                                                Math.min(index, 6) * 40,
                                        )
                                                .springify()
                                                .damping(22)
                                                .stiffness(220)}
                                        style={[s.card, cardStyle]}
                                >
                                        <View
                                                style={[
                                                        s.accent,
                                                        { backgroundColor: catColor },
                                                ]}
                                        />

                                        {clean.length > 0 && (
                                                <Markdown
                                                        style={{
                                                                body: s.text,
                                                                heading1: s.text,
                                                                heading2: s.text,
                                                                heading3: s.text,
                                                                heading4: s.text,
                                                                heading5: s.text,
                                                                heading6: s.text,
                                                                blockquote: {
                                                                        backgroundColor:
                                                                                "rgba(255,255,255,0.03)",
                                                                        borderLeftWidth: 2,
                                                                        borderLeftColor:
                                                                                "rgba(255,255,255,0.15)",
                                                                        paddingLeft: 10,
                                                                        paddingVertical: 4,
                                                                        borderRadius: 4,
                                                                        opacity: 0.85,
                                                                },
                                                                code_inline: {
                                                                        backgroundColor:
                                                                                "rgba(255,255,255,0.06)",
                                                                        color: "rgba(255,255,255,0.7)",
                                                                        fontFamily:
                                                                                FONTS.mono,
                                                                        fontSize: 12,
                                                                        paddingHorizontal: 4,
                                                                        borderRadius: 3,
                                                                },
                                                                code_block: {
                                                                        backgroundColor:
                                                                                "rgba(255,255,255,0.04)",
                                                                        color: "rgba(255,255,255,0.7)",
                                                                },
                                                                fence: {
                                                                        backgroundColor:
                                                                                "rgba(255,255,255,0.04)",
                                                                        color: "rgba(255,255,255,0.7)",
                                                                        padding: 10,
                                                                        borderRadius: 8,
                                                                        marginVertical: 6,
                                                                },
                                                                link: {
                                                                        color: COLORS.accentBlue,
                                                                },
                                                        }}
                                                >
                                                        {preview}
                                                </Markdown>
                                        )}

                                        {note.attachments.length > 0 && (
                                                <View style={s.attRow}>
                                                        {note.attachments.map(
                                                                (a) => (
                                                                        <View
                                                                                key={a.id}
                                                                                style={
                                                                                        s.attChip
                                                                                }
                                                                        >
                                                                                <Feather
                                                                                        name={attIconName(
                                                                                                a.type,
                                                                                        )}
                                                                                        size={10}
                                                                                        color="rgba(255,255,255,0.35)"
                                                                                />
                                                                                <Text
                                                                                        style={
                                                                                                s.attText
                                                                                        }
                                                                                >
                                                                                        {a.name}
                                                                                </Text>
                                                                        </View>
                                                                ),
                                                        )}
                                                </View>
                                        )}

                                        <View style={s.footer}>
                                                {labels.length === 0 ? (
                                                        <View
                                                                style={[
                                                                        s.tag,
                                                                        {
                                                                                borderColor:
                                                                                        "rgba(255,255,255,0.06)",
                                                                        },
                                                                ]}
                                                        >
                                                                <Text
                                                                        style={
                                                                                s.tagLabel
                                                                        }
                                                                >
                                                                        untagged
                                                                </Text>
                                                        </View>
                                                ) : (
                                                        labels
                                                                .slice(0, 3)
                                                                .map((name) => {
                                                                        const color = getCategoryColor(
                                                                                name,
                                                                        );
                                                                        return (
                                                                                <View
                                                                                        key={name}
                                                                                        style={[
                                                                                                s.tag,
                                                                                                {
                                                                                                        borderColor:
                                                                                                                color +
                                                                                                                "44",
                                                                                                },
                                                                                        ]}
                                                                                >
                                                                                        <View
                                                                                                style={[
                                                                                                        s.tagDot,
                                                                                                        {
                                                                                                                backgroundColor:
                                                                                                                        color,
                                                                                                        },
                                                                                                ]}
                                                                                        />
                                                                                        <Text
                                                                                                style={
                                                                                                        s.tagLabel
                                                                                                }
                                                                                        >
                                                                                                {name}
                                                                                        </Text>
                                                                                </View>
                                                                        );
                                                                })
                                                )}
                                                {extraLabels > 0 && (
                                                        <Text style={s.tagLabel}>
                                                                +{extraLabels}
                                                        </Text>
                                                )}
                                                <Text style={s.time}>
                                                        {formattedDate}
                                                </Text>
                                                <View style={{ flex: 1 }} />
                                                {note.issueUrl ? (
                                                        <Pressable
                                                                onPress={openIssue}
                                                                hitSlop={10}
                                                        >
                                                                <Feather
                                                                        name="external-link"
                                                                        size={12}
                                                                        color="rgba(255,255,255,0.25)"
                                                                />
                                                        </Pressable>
                                                ) : null}
                                                {note.issueNumber ? (
                                                        <View
                                                                style={
                                                                        s.syncedBadge
                                                                }
                                                        >
                                                                <Animated.View
                                                                        style={[
                                                                                s.syncedDot,
                                                                                syncDotStyle,
                                                                        ]}
                                                                />
                                                        </View>
                                                ) : (
                                                        <Animated.View
                                                                style={[
                                                                        s.unsyncedDot,
                                                                        syncDotStyle,
                                                                ]}
                                                        />
                                                )}
                                        </View>
                                </Animated.View>
                        </View>
                </GestureDetector>
        );
}

const s = StyleSheet.create({
        card: {
                backgroundColor: "rgba(255,255,255,0.024)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 14,
                paddingLeft: 20,
                marginBottom: 8,
                overflow: "hidden",
        },
        accent: {
                position: "absolute",
                left: 0,
                top: 14,
                bottom: 14,
                width: 2.5,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
                opacity: 0.65,
        },
        text: {
                fontSize: 14.5,
                lineHeight: 22,
                color: COLORS.textPrimary,
                marginBottom: 10,
                letterSpacing: 0.08,
        },
        attRow: {
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 5,
                marginBottom: 10,
        },
        attChip: {
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 2,
                paddingHorizontal: 8,
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.07)",
        },
        attText: {
                fontSize: 10,
                color: COLORS.textTertiary,
                fontFamily: FONTS.mono,
        },
        footer: { flexDirection: "row", alignItems: "center", gap: 8 },
        tag: {
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingVertical: 2,
                paddingHorizontal: 7,
                borderRadius: 100,
                borderWidth: 0.5,
                backgroundColor: "rgba(255,255,255,0.03)",
        },
        tagDot: { width: 4, height: 4, borderRadius: 2, opacity: 0.7 },
        tagLabel: {
                fontSize: 9.5,
                color: COLORS.textTertiary,
                fontFamily: FONTS.mono,
                letterSpacing: 0.4,
        },
        time: {
                fontSize: 9.5,
                color: "rgba(255,255,255,0.18)",
                fontFamily: FONTS.mono,
                letterSpacing: 0.3,
        },
        syncedBadge: { marginLeft: "auto" },
        syncedDot: {
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: COLORS.success,
        },
        unsyncedDot: {
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: COLORS.accentBlue,
        },
        deleteHint: {
                position: "absolute",
                right: 20,
                top: 0,
                bottom: 8,
                justifyContent: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
        },
        deleteHintText: {
                fontSize: 10,
                fontFamily: FONTS.mono,
                color: "rgba(240,80,80,0.5)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
        },
});
