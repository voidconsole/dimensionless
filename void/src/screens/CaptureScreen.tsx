import React, { useRef, useState, useCallback, useEffect } from "react";
import {
        View,
        TextInput,
        Text,
        StyleSheet,
        TouchableOpacity,
        Platform,
        Pressable,
        KeyboardAvoidingView,
        ScrollView,
        Modal,
        Keyboard,
} from "react-native";
import Animated, {
        useSharedValue,
        useAnimatedStyle,
        withSpring,
        withTiming,
        withSequence,
        withRepeat,
        Easing,
        runOnJS,
        FadeIn,
        FadeOut,
        FadeInUp,
        interpolate,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, SPRING } from "../theme/index";
import { SendButton } from "../components/SendButton";
import { useHaptic } from "../hooks/useHaptic";
import { useRecording } from "../hooks/useRecording";
import { useNoteStore, createNote } from "../store/useNoteStore";
import { useLabelStore } from "../store/useLabelStore";
import { captureNote } from "../services/github";
import type { Attachment, GitHubLabel } from "../services/github";
import { playPop, playSuccess, playError, playTap } from "../services/sound";

type IconName = React.ComponentProps<typeof Feather>["name"];

const H_PADDING = Platform.OS === "web" ? 48 : 22;
const EDIT_FONT = Platform.OS === "web" ? 22 : 20;
const EDIT_LINE = Platform.OS === "web" ? 38 : 32;

function attIconName(type: Attachment["type"]): IconName {
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

function webFileToAttachment(file: File): Attachment {
        const mime = file.type || "application/octet-stream";
        let type: Attachment["type"] = "file";
        if (mime.startsWith("image/")) type = "image";
        else if (mime.startsWith("video/")) type = "video";
        else if (mime.startsWith("audio/")) type = "voice";
        const name = file.name || `file_${Date.now()}`;
        return {
                id: `w${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                type,
                uri: URL.createObjectURL(file),
                name,
                mimeType: mime,
        };
}

function AttachChip({
        att,
        onRemove,
        onInsert,
}: {
        att: Attachment;
        onRemove: () => void;
        onInsert: () => void;
}) {
        const scale = useSharedValue(0);
        useEffect(() => {
                scale.value = withSpring(1, SPRING.bouncy);
        }, []);
        const style = useAnimatedStyle(() => ({
                transform: [{ scale: scale.value }],
        }));
        return (
                <Animated.View style={[chipS.wrap, style]}>
                        <Pressable onPress={onInsert} style={chipS.main} hitSlop={6}>
                                <Feather
                                        name={attIconName(att.type)}
                                        size={11}
                                        color="rgba(255,255,255,0.45)"
                                />
                                <Text style={chipS.label} numberOfLines={1}>
                                        {att.name}
                                </Text>
                                <Feather
                                        name="plus"
                                        size={10}
                                        color="rgba(255,255,255,0.25)"
                                />
                        </Pressable>
                        <Pressable onPress={onRemove} hitSlop={10} style={chipS.x}>
                                <Feather name="x" size={11} color="rgba(255,255,255,0.35)" />
                        </Pressable>
                </Animated.View>
        );
}

const chipS = StyleSheet.create({
        wrap: {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                maxWidth: 220,
        },
        main: {
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 4,
                paddingLeft: 9,
                paddingRight: 4,
                flexShrink: 1,
        },
        label: {
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                flexShrink: 1,
        },
        x: { paddingHorizontal: 6, paddingVertical: 4 },
});

function RecordingBar({ formatted }: { formatted: string }) {
        const dot = useSharedValue(1);
        useEffect(() => {
                const pulse = () => {
                        dot.value = withSequence(
                                withTiming(0.15, { duration: 500 }),
                                withTiming(1, { duration: 500 }),
                        );
                };
                pulse();
                const id = setInterval(pulse, 1000);
                return () => clearInterval(id);
        }, []);
        const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
        return (
                <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={recS.bar}
                >
                        <Animated.View style={[recS.dot, dotStyle]} />
                        <Feather name="mic" size={10} color="rgba(222,88,88,0.8)" />
                        <Text style={recS.time}>{formatted}</Text>
                </Animated.View>
        );
}

const recS = StyleSheet.create({
        bar: {
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingVertical: 5,
                paddingHorizontal: 12,
                backgroundColor: "rgba(220,52,52,0.08)",
                borderWidth: 0.5,
                borderColor: "rgba(220,52,52,0.20)",
                borderRadius: 100,
                alignSelf: "flex-start",
                marginBottom: 12,
        },
        dot: {
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: "rgba(222,62,62,0.9)",
        },
        time: {
                fontSize: 10.5,
                color: "rgba(222,88,88,0.8)",
                fontFamily: "Courier New",
                letterSpacing: 1,
        },
});

function ToastMsg({ msg, ok }: { msg: string; ok: boolean }) {
        return (
                <Animated.View
                        entering={FadeIn.duration(200).springify().damping(12)}
                        exiting={FadeOut.duration(250)}
                        style={[
                                toastS.wrap,
                                {
                                        borderColor: ok
                                                ? "rgba(72,199,142,0.2)"
                                                : "rgba(240,80,80,0.2)",
                                },
                        ]}
                >
                        <Feather
                                name={ok ? "check" : "alert-circle"}
                                size={13}
                                color={
                                        ok
                                                ? "rgba(72,199,142,0.85)"
                                                : "rgba(240,80,80,0.85)"
                                }
                        />
                        <Text style={toastS.text}>{msg}</Text>
                </Animated.View>
        );
}

const toastS = StyleSheet.create({
        wrap: {
                position: "absolute",
                bottom: 92,
                alignSelf: "center",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(10,10,12,0.94)",
                borderWidth: 0.5,
                borderRadius: 100,
                paddingVertical: 9,
                paddingHorizontal: 18,
                zIndex: 99,
                shadowColor: "#000",
                shadowOpacity: 0.5,
                shadowRadius: 20,
                elevation: 24,
        },
        text: {
                fontSize: 12,
                fontFamily: "Courier New",
                color: "rgba(255,255,255,0.75)",
                letterSpacing: 0.6,
        },
});

function LabelPickerModal({
        visible,
        labels,
        selected,
        onToggle,
        onClose,
}: {
        visible: boolean;
        labels: GitHubLabel[];
        selected: string[];
        onToggle: (name: string) => void;
        onClose: () => void;
}) {
        const { light } = useHaptic();
        return (
                <Modal
                        transparent
                        visible={visible}
                        animationType="slide"
                        onRequestClose={onClose}
                        statusBarTranslucent
                >
                        <View style={lpS.backdropWrap}>
                                <Pressable
                                        style={lpS.backdrop}
                                        onPress={onClose}
                                />
                                <Animated.View
                                        entering={FadeInUp.duration(220).springify().damping(20)}
                                        style={lpS.sheet}
                                >
                                        <View style={lpS.handle} />
                                        <View style={lpS.sheetHeader}>
                                                <Text style={lpS.title}>
                                                        labels
                                                </Text>
                                                <Text style={lpS.subtitle}>
                                                        pick any number
                                                </Text>
                                        </View>
                                        <ScrollView
                                                style={lpS.list}
                                                showsVerticalScrollIndicator={false}
                                                bounces
                                        >
                                                {labels.map((label) => {
                                                        const active =
                                                                selected.includes(
                                                                        label.name,
                                                                );
                                                        return (
                                                                <TouchableOpacity
                                                                        key={label.name}
                                                                        onPress={() => {
                                                                                light();
                                                                                onToggle(
                                                                                        label.name,
                                                                                );
                                                                        }}
                                                                        activeOpacity={0.7}
                                                                        style={[
                                                                                lpS.row,
                                                                                active &&
                                                                                        lpS.rowActive,
                                                                        ]}
                                                                >
                                                                        <View
                                                                                style={[
                                                                                        lpS.dot,
                                                                                        {
                                                                                                backgroundColor: `#${label.color}`,
                                                                                        },
                                                                                ]}
                                                                        />
                                                                        <Text
                                                                                style={[
                                                                                        lpS.rowText,
                                                                                        active &&
                                                                                                lpS.rowTextActive,
                                                                                ]}
                                                                                numberOfLines={1}
                                                                        >
                                                                                {label.name}
                                                                        </Text>
                                                                        {active ? (
                                                                                <Feather
                                                                                        name="check-circle"
                                                                                        size={18}
                                                                                        color="#7ba8ff"
                                                                                />
                                                                        ) : (
                                                                                <Feather
                                                                                        name="circle"
                                                                                        size={18}
                                                                                        color="rgba(255,255,255,0.12)"
                                                                                />
                                                                        )}
                                                                </TouchableOpacity>
                                                        );
                                                })}
                                                {labels.length === 0 && (
                                                        <Text style={lpS.empty}>
                                                                connect github to
                                                                load labels
                                                        </Text>
                                                )}
                                        </ScrollView>
                                        <TouchableOpacity
                                                style={lpS.done}
                                                onPress={() => {
                                                        playTap();
                                                        onClose();
                                                }}
                                                activeOpacity={0.8}
                                        >
                                                <Text style={lpS.doneText}>
                                                        done
                                                </Text>
                                        </TouchableOpacity>
                                </Animated.View>
                        </View>
                </Modal>
        );
}

function LabelSelector({
        labels,
        selected,
        onOpen,
}: {
        labels: GitHubLabel[];
        selected: string[];
        onOpen: () => void;
}) {
        const scale = useSharedValue(1);
        const first = labels.find((l) => l.name === selected[0]);
        const dotColor = first ? `#${first.color}` : "#666";
        const count = selected.length;
        const display =
                count === 0
                        ? "label"
                        : count === 1
                          ? selected[0]
                          : `${selected[0]} +${count - 1}`;

        return (
                <TouchableOpacity
                        onPress={() => {
                                playTap();
                                scale.value = withSequence(
                                        withSpring(0.92, {
                                                damping: 15,
                                                stiffness: 500,
                                        }),
                                        withSpring(1, SPRING.snappy),
                                );
                                onOpen();
                        }}
                        activeOpacity={0.7}
                        style={lsS.trigger}
                >
                        <Animated.View
                                style={[
                                        lsS.triggerInner,
                                        { transform: [{ scale }] },
                                ]}
                        >
                                <View
                                        style={[
                                                lsS.dot,
                                                { backgroundColor: dotColor },
                                        ]}
                                />
                                <Text
                                        style={lsS.triggerText}
                                        numberOfLines={1}
                                >
                                        {display}
                                </Text>
                                <Feather
                                        name="chevron-down"
                                        size={12}
                                        color="rgba(255,255,255,0.3)"
                                />
                        </Animated.View>
                </TouchableOpacity>
        );
}

const lpS = StyleSheet.create({
        backdropWrap: { flex: 1, justifyContent: "flex-end" },
        backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
        sheet: {
                backgroundColor: "rgba(16,16,18,0.98)",
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.1)",
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 26,
                maxHeight: "70%",
        },
        handle: {
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.15)",
                marginBottom: 12,
        },
        sheetHeader: {
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 8,
                paddingHorizontal: 4,
        },
        title: {
                fontFamily: "Courier New",
                fontSize: 12,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.6)",
        },
        subtitle: {
                fontFamily: "Courier New",
                fontSize: 10,
                color: "rgba(255,255,255,0.25)",
                letterSpacing: 0.5,
        },
        list: { flexGrow: 0, maxHeight: 300 },
        row: {
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 10,
                borderRadius: 10,
                marginBottom: 2,
        },
        rowActive: { backgroundColor: "rgba(123,168,255,0.07)" },
        dot: { width: 9, height: 9, borderRadius: 5 },
        rowText: {
                flex: 1,
                fontSize: 14,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 0.2,
        },
        rowTextActive: { color: "rgba(255,255,255,0.9)", fontWeight: "500" },
        empty: {
                padding: 24,
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "Courier New",
                fontSize: 12,
            },
        done: {
                marginTop: 10,
                backgroundColor: "rgba(210,226,255,0.92)",
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
        },
        doneText: { fontSize: 14, fontWeight: "600", color: "#06060a", letterSpacing: 0.3 },
});

const lsS = StyleSheet.create({
        trigger: { zIndex: 20 },
        triggerInner: {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 100,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.1)",
                backgroundColor: "rgba(255,255,255,0.03)",
                maxWidth: 150,
        },
        dot: { width: 6, height: 6, borderRadius: 3 },
        triggerText: {
                fontSize: 11,
                fontWeight: "500",
                color: "rgba(255,255,255,0.65)",
                letterSpacing: 0.2,
                flexShrink: 1,
        },
});

function IconBtn({
        name,
        onPress,
        active,
        activeColor,
        tint,
}: {
        name: IconName;
        onPress: () => void;
        active?: boolean;
        activeColor?: string;
        tint?: string;
}) {
        const scale = useSharedValue(1);
        const handlePress = () => {
                scale.value = withSequence(
                        withSpring(0.85, { damping: 12, stiffness: 600 }),
                        withSpring(1, SPRING.snappy),
                );
                onPress();
        };
        const style = useAnimatedStyle(() => ({
                transform: [{ scale: scale.value }],
        }));
        const color = active
                ? (activeColor ?? "rgba(222,62,62,0.85)")
                : (tint ?? "rgba(255,255,255,0.42)");
        return (
                <TouchableOpacity
                        onPress={handlePress}
                        activeOpacity={0.7}
                        style={[
                                tbS.iconBtn,
                                active && {
                                        backgroundColor: "rgba(220,52,52,0.1)",
                                        borderColor: "rgba(220,52,52,0.22)",
                                },
                        ]}
                >
                        <Animated.View style={style}>
                                <Feather name={name} size={16} color={color} />
                        </Animated.View>
                </TouchableOpacity>
        );
}

function Toolbar({
        labels,
        selectedLabels,
        onOpenLabels,
        onPickFile,
        onPickCamera,
        onPickVideo,
        onToggleRecording,
        isRecording,
        hasContent,
        onSend,
        sending,
}: {
        labels: GitHubLabel[];
        selectedLabels: string[];
        onOpenLabels: () => void;
        onPickFile: () => void;
        onPickCamera: () => void;
        onPickVideo: () => void;
        onToggleRecording: () => void;
        isRecording: boolean;
        hasContent: boolean;
        onSend: () => void;
        sending: boolean;
}) {
        return (
                <View style={tbS.container}>
                        <View style={tbS.row}>
                                <LabelSelector
                                        labels={labels}
                                        selected={selectedLabels}
                                        onOpen={onOpenLabels}
                                />
                                <View
                                        style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 6,
                                        }}
                                >
                                        <IconBtn name="paperclip" onPress={onPickFile} />
                                        <IconBtn name="image" onPress={onPickCamera} />
                                        <IconBtn name="video" onPress={onPickVideo} />
                                        <IconBtn
                                                name="mic"
                                                onPress={onToggleRecording}
                                                active={isRecording}
                                        />
                                </View>
                                <View style={{ flex: 1 }} />
                                <SendButton
                                        hasContent={hasContent}
                                        onSend={onSend}
                                        disabled={sending}
                                />
                        </View>
                </View>
        );
}

const tbS = StyleSheet.create({
        container: {
                backgroundColor: "rgba(8,8,10,0.98)",
                borderTopWidth: 0.5,
                borderTopColor: "rgba(255,255,255,0.08)",
                paddingVertical: Platform.OS === "android" ? 8 : 6,
                paddingHorizontal: 12,
                zIndex: 30,
        },
        row: {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
        },
        iconBtn: {
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.03)",
                alignItems: "center",
                justifyContent: "center",
        },
});

export function CaptureScreen() {
        const insets = useSafeAreaInsets();
        const inputRef = useRef<TextInput>(null);
        const titleRef = useRef<TextInput>(null);
        const selectionRef = useRef<{ start: number; end: number }>({
                start: 0,
                end: 0,
        });
        const {
                sendPulse,
                light,
                success: hapticSuccess,
                error: hapticError,
        } = useHaptic();
        const recording = useRecording();
        const { addNote, updateNote, notes } = useNoteStore();
        const { labels } = useLabelStore();

        const [title, setTitle] = useState("");
        const [text, setText] = useState("");
        const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
        const [labelsOpen, setLabelsOpen] = useState(false);
        const [attachments, setAttachments] = useState<Attachment[]>([]);
        const [sending, setSending] = useState(false);
        const [toast, setToast] = useState<{
                msg: string;
                ok: boolean;
        } | null>(null);
        const [webDrag, setWebDrag] = useState(false);

        useEffect(() => {
                if (Platform.OS !== "web") return;
                let depth = 0;
                const hasFiles = (e: DragEvent) =>
                        Array.from(e.dataTransfer?.types ?? []).includes(
                                "Files",
                        );
                const onDragEnter = (e: DragEvent) => {
                        e.preventDefault();
                        if (!hasFiles(e)) return;
                        depth++;
                        setWebDrag(true);
                };
                const onDragOver = (e: DragEvent) => {
                        e.preventDefault();
                };
                const onDragLeave = (e: DragEvent) => {
                        e.preventDefault();
                        if (!hasFiles(e)) return;
                        depth = Math.max(0, depth - 1);
                        if (depth === 0) setWebDrag(false);
                };
                const onDrop = (e: DragEvent) => {
                        e.preventDefault();
                        depth = 0;
                        setWebDrag(false);
                        const files = Array.from(e.dataTransfer?.files ?? []);
                        if (files.length > 0) {
                                const atts = files.map(webFileToAttachment);
                                setAttachments((p) => [...p, ...atts]);
                                light();
                                playPop();
                        } else {
                                const text = e.dataTransfer?.getData(
                                        "text/plain",
                                );
                                if (text) {
                                        const pos =
                                                selectionRef.current.start ??
                                                text.length;
                                        setText((prev) =>
                                                prev.slice(0, pos) +
                                                        text +
                                                        prev.slice(pos),
                                        );
                                        light();
                                        playPop();
                                }
                        }
                };
                window.addEventListener("dragenter", onDragEnter);
                window.addEventListener("dragover", onDragOver);
                window.addEventListener("dragleave", onDragLeave);
                window.addEventListener("drop", onDrop);
                return () => {
                        window.removeEventListener("dragenter", onDragEnter);
                        window.removeEventListener("dragover", onDragOver);
                        window.removeEventListener("dragleave", onDragLeave);
                        window.removeEventListener("drop", onDrop);
                };
        }, [light]);

        const textOpacity = useSharedValue(1);
        const textY = useSharedValue(0);
        const countFlash = useSharedValue(0);
        const glowPulse = useSharedValue(0.5);

        const hasContent =
                title.trim().length > 0 ||
                text.trim().length > 0 ||
                attachments.length > 0;

        useEffect(() => {
                if (labels.length > 0 && selectedLabels.length === 0) {
                        setSelectedLabels([labels[0].name]);
                }
        }, [labels]);

        const toggleLabel = (name: string) => {
                setSelectedLabels((prev) =>
                        prev.includes(name)
                                ? prev.filter((l) => l !== name)
                                : [...prev, name],
                );
        };

        useEffect(() => {
                if (hasContent) {
                        glowPulse.value = withRepeat(
                                withSequence(
                                        withTiming(1, {
                                                duration: 2000,
                                                easing: Easing.inOut(Easing.sin),
                                        }),
                                        withTiming(0.3, {
                                                duration: 2000,
                                                easing: Easing.inOut(Easing.sin),
                                        }),
                                ),
                                -1,
                                true,
                        );
                } else {
                        glowPulse.value = withTiming(0.5, { duration: 600 });
                }
        }, [hasContent]);

        const showToast = (msg: string, ok: boolean) => {
                setToast({ msg, ok });
                setTimeout(() => setToast(null), 2200);
        };

        const handleSend = useCallback(async () => {
                if (!hasContent || sending) return;
                setSending(true);
                sendPulse();
                playPop();

                textOpacity.value = withTiming(0, {
                        duration: 220,
                        easing: Easing.out(Easing.quad),
                });
                textY.value = withTiming(-70, {
                        duration: 220,
                        easing: Easing.out(Easing.quad),
                });

                const note = createNote(
                        title,
                        text,
                        selectedLabels,
                        attachments,
                );
                addNote(note);

                runOnJS(showToast)("captured", true);

                setTimeout(() => {
                        setTitle("");
                        setText("");
                        setAttachments([]);
                        textOpacity.value = 1;
                        textY.value = 0;
                        setSending(false);
                        countFlash.value = withSequence(
                                withTiming(1, { duration: 100 }),
                                withTiming(0, {
                                        duration: 900,
                                        easing: Easing.out(Easing.quad),
                                }),
                        );
                        titleRef.current?.focus();
                }, 160);

                const result = await captureNote(note);
                if (result.ok && result.issueNumber) {
                        updateNote(note.id, {
                                synced: true,
                                issueNumber: result.issueNumber,
                                issueUrl: result.issueUrl,
                        });
                        runOnJS(hapticSuccess)();
                        runOnJS(playSuccess)();
                        runOnJS(showToast)(
                                `#${result.issueNumber} captured`,
                                true,
                        );
                } else {
                        runOnJS(hapticError)();
                        runOnJS(playError)();
                        runOnJS(showToast)(
                                result.error ?? "Queued — will sync later",
                                false,
                        );
                }
        }, [hasContent, sending, title, text, selectedLabels, attachments]);

        const sendRef = useRef<() => void>(() => {});
        sendRef.current = handleSend;

        useEffect(() => {
                if (Platform.OS !== "web") return;
                const onKeyDown = (e: KeyboardEvent) => {
                        const tag = (document.activeElement as HTMLElement | null)
                                ?.tagName;
                        if (
                                e.key === "Enter" &&
                                e.shiftKey &&
                                (tag === "INPUT" || tag === "TEXTAREA")
                        ) {
                                e.preventDefault();
                                sendRef.current();
                        }
                };
                document.addEventListener("keydown", onKeyDown, true);
                return () =>
                        document.removeEventListener("keydown", onKeyDown, true);
        }, []);

        const insertAtCursor = (token: string) => {
                const pos = selectionRef.current.start ?? text.length;
                const next = text.slice(0, pos) + token + text.slice(pos);
                setText(next);
                inputRef.current?.focus();
                setTimeout(() => {
                        inputRef.current?.setSelection(
                                pos + token.length,
                                pos + token.length,
                        );
                }, 60);
                light();
                playTap();
        };

        const handleAttachInsert = (att: Attachment) => {
                insertAtCursor(`{{att:${att.id}}}`);
        };

        const pickCamera = async (video?: boolean) => {
                if (Platform.OS === "web") {
                        // no camera capture in the browser — pick from library
                        const res =
                                await ImagePicker.launchImageLibraryAsync({
                                        mediaTypes: video
                                                ? ImagePicker.MediaTypeOptions.Videos
                                                : ImagePicker.MediaTypeOptions.Images,
                                        quality: 0.85,
                                });
                        if (!res.canceled && res.assets[0]) {
                                const a = res.assets[0];
                                const ext = video ? "mp4" : "jpg";
                                setAttachments((p) => [
                                        ...p,
                                        {
                                                id: Date.now().toString(),
                                                type: video
                                                        ? "video"
                                                        : "image",
                                                uri: a.uri,
                                                name: `${video ? "video" : "photo"}_${Date.now()}.${ext}`,
                                                mimeType: video
                                                        ? "video/mp4"
                                                        : "image/jpeg",
                                        },
                                ]);
                                light();
                        }
                        inputRef.current?.focus();
                        return;
                }
                const { granted } =
                        await ImagePicker.requestCameraPermissionsAsync();
                if (!granted) return;
                const res = await ImagePicker.launchCameraAsync({
                        mediaTypes: video
                                ? ImagePicker.MediaTypeOptions.Videos
                                : ImagePicker.MediaTypeOptions.Images,
                        quality: 0.85,
                });
                if (!res.canceled && res.assets[0]) {
                        const a = res.assets[0];
                        const ext = video ? "mp4" : "jpg";
                        setAttachments((p) => [
                                ...p,
                                {
                                        id: Date.now().toString(),
                                        type: video ? "video" : "image",
                                        uri: a.uri,
                                        name: `${video ? "video" : "photo"}_${Date.now()}.${ext}`,
                                        mimeType: video
                                                ? "video/mp4"
                                                : "image/jpeg",
                                },
                        ]);
                        light();
                }
                inputRef.current?.focus();
        };

        const pickFile = async () => {
                const res = await DocumentPicker.getDocumentAsync({
                        copyToCacheDirectory: true,
                });
                if (!res.canceled && res.assets[0]) {
                        const a = res.assets[0];
                        setAttachments((p) => [
                                ...p,
                                {
                                        id: Date.now().toString(),
                                        type: "file",
                                        uri: a.uri,
                                        name: a.name,
                                        mimeType: a.mimeType ?? undefined,
                                },
                        ]);
                        light();
                }
                inputRef.current?.focus();
        };

        const toggleRecording = async () => {
                if (recording.isRecording) {
                        const result = await recording.stop();
                        if (result) {
                                setAttachments((p) => [
                                        ...p,
                                        {
                                                id: Date.now().toString(),
                                                type: "voice",
                                                uri: result.uri,
                                                name: `voice_${result.durationSecs}s.m4a`,
                                                mimeType: "audio/mp4",
                                                durationSecs:
                                                        result.durationSecs,
                                        },
                                ]);
                                light();
                        }
                } else {
                        await recording.start();
                        light();
                }
                inputRef.current?.focus();
        };

        const textAnimStyle = useAnimatedStyle(() => ({
                opacity: textOpacity.value,
                transform: [{ translateY: textY.value }],
        }));
        const countStyle = useAnimatedStyle(() => ({
                color:
                        countFlash.value > 0.5
                                ? "rgba(155,194,255,0.8)"
                                : "rgba(255,255,255,0.15)",
                transform: [{ scale: 1 + countFlash.value * 0.08 }],
        }));
        const glowStyle = useAnimatedStyle(() => ({
                opacity: interpolate(
                        glowPulse.value,
                        [0, 0.5, 1],
                        [0.02, 0.055, 0.09],
                ),
                transform: [{ scale: 1 + glowPulse.value * 0.05 }],
        }));

        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        const charCount = text.length;

        return (
                <View style={[s.screen, { paddingTop: insets.top }]}>
                        <Animated.View
                                style={[s.glow, glowStyle]}
                                pointerEvents="none"
                        />

                        <View style={s.topBar}>
                                <Text style={s.logo}>VOID</Text>
                                <View style={s.topRight}>
                                        {hasContent && (
                                                <Animated.View
                                                        entering={FadeIn.duration(200)}
                                                        style={s.metrics}
                                                >
                                                        <Text style={s.metricText}>
                                                                {wordCount}w
                                                        </Text>
                                                        <Text style={s.metricDivider}>
                                                                ·
                                                        </Text>
                                                        <Text style={s.metricText}>
                                                                {charCount}c
                                                        </Text>
                                                </Animated.View>
                                        )}
                                        <Animated.Text
                                                style={[s.count, countStyle]}
                                        >
                                                {notes.length}
                                        </Animated.Text>
                                </View>
                        </View>

                        <KeyboardAvoidingView
                                behavior={
                                        Platform.OS === "ios"
                                                ? "padding"
                                                : undefined
                                }
                                style={{ flex: 1 }}
                        >
                                <View style={s.compose}>
                                        {attachments.length > 0 && (
                                                <ScrollView
                                                        horizontal
                                                        showsHorizontalScrollIndicator={false}
                                                        style={s.chips}
                                                        contentContainerStyle={{
                                                                gap: 6,
                                                                paddingRight: 4,
                                                        }}
                                                        keyboardShouldPersistTaps="handled"
                                                >
                                                        {attachments.map((a) => (
                                                                <AttachChip
                                                                        key={a.id}
                                                                        att={a}
                                                                        onRemove={() =>
                                                                                setAttachments(
                                                                                        (p) =>
                                                                                                p.filter(
                                                                                                        (x) =>
                                                                                                                x.id !==
                                                                                                                a.id,
                                                                                                ),
                                                                                )
                                                                        }
                                                                        onInsert={() =>
                                                                                handleAttachInsert(a)
                                                                        }
                                                                />
                                                        ))}
                                                </ScrollView>
                                        )}
                                        {recording.isRecording && (
                                                <RecordingBar
                                                        formatted={
                                                                recording.formatted
                                                        }
                                                />
                                        )}
                                        <Animated.View
                                                style={[
                                                        { flex: 1 },
                                                        textAnimStyle,
                                                ]}
                                        >
                                                <View style={s.titleBox}>
                                                        <Feather
                                                                name="type"
                                                                size={12}
                                                                color="rgba(255,255,255,0.18)"
                                                        />
                                                        <TextInput
                                                                ref={titleRef}
                                                                value={title}
                                                                onChangeText={
                                                                        setTitle
                                                                }
                                                                placeholder="title…"
                                                                placeholderTextColor="rgba(255,255,255,0.16)"
                                                                style={s.titleInput}
                                                                multiline={false}
                                                                autoFocus
                                                                autoCorrect
                                                                autoCapitalize="sentences"
                                                                keyboardAppearance="dark"
                                                                selectionColor={
                                                                        COLORS.caret
                                                                }
                                                        />
                                                </View>
                                                <TextInput
                                                        ref={inputRef}
                                                        value={text}
                                                        onChangeText={setText}
                                                        onSelectionChange={(e) => {
                                                                selectionRef.current =
                                                                        e.nativeEvent
                                                                                .selection;
                                                        }}
                                                        placeholder="pour it in…"
                                                        placeholderTextColor="rgba(255,255,255,0.12)"
                                                        style={s.input}
                                                        multiline
                                                        autoCorrect
                                                        autoCapitalize="sentences"
                                                        keyboardAppearance="dark"
                                                        selectionColor={COLORS.caret}
                                                        textAlignVertical="top"
                                                />
                                        </Animated.View>
                                </View>
                        </KeyboardAvoidingView>

                        <Toolbar
                                labels={labels}
                                selectedLabels={selectedLabels}
                                onOpenLabels={() => {
                                        Keyboard.dismiss();
                                        setLabelsOpen(true);
                                }}
                                onPickFile={pickFile}
                                onPickCamera={() => pickCamera(false)}
                                onPickVideo={() => pickCamera(true)}
                                onToggleRecording={toggleRecording}
                                isRecording={recording.isRecording}
                                hasContent={hasContent}
                                onSend={handleSend}
                                sending={sending}
                        />

                        <LabelPickerModal
                                visible={labelsOpen}
                                labels={labels}
                                selected={selectedLabels}
                                onToggle={toggleLabel}
                                onClose={() => setLabelsOpen(false)}
                        />

                        {toast && <ToastMsg msg={toast.msg} ok={toast.ok} />}

                        {webDrag && (
                                <View style={dropS.overlay} pointerEvents="none">
                                        <Animated.View
                                                entering={FadeIn.duration(140)}
                                                style={dropS.box}
                                        >
                                                <Feather
                                                        name="upload-cloud"
                                                        size={34}
                                                        color="rgba(155,198,255,0.85)"
                                                />
                                                <Text style={dropS.text}>
                                                        drop to attach
                                                </Text>
                                        </Animated.View>
                                </View>
                        )}
                </View>
        );
}

const s = StyleSheet.create({
        screen: { flex: 1, backgroundColor: COLORS.void },
        glow: {
                position: "absolute",
                top: -180,
                left: "50%",
                marginLeft: -250,
                width: 500,
                height: 500,
                borderRadius: 250,
                backgroundColor: "rgba(70,110,240,0.06)",
        },
        topBar: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 22,
                paddingTop: 12,
                paddingBottom: 4,
                zIndex: 1,
        },
        logo: {
                fontFamily: "Courier New",
                fontSize: 10,
                letterSpacing: 4,
                color: "rgba(255,255,255,0.14)",
                textTransform: "uppercase",
        },
        topRight: { flexDirection: "row", alignItems: "center", gap: 12 },
        metrics: { flexDirection: "row", alignItems: "center", gap: 4 },
        metricText: {
                fontFamily: "Courier New",
                fontSize: 9,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: 1,
        },
        metricDivider: { fontSize: 9, color: "rgba(255,255,255,0.08)" },
        count: {
                fontFamily: "Courier New",
                fontSize: 10,
                letterSpacing: 1.5,
        },
        compose: {
                flex: 1,
                paddingHorizontal: H_PADDING,
                paddingTop: 8,
                zIndex: 1,
        },
        chips: {
                flexGrow: 0,
                marginBottom: 10,
        },
        titleBox: {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.02)",
                paddingVertical: 6,
                paddingHorizontal: 12,
                marginBottom: 10,
        },
        titleInput: {
                flex: 1,
                color: "rgba(255,255,255,0.35)",
                fontSize: 15,
                fontWeight: "400",
                letterSpacing: 0.15,
                padding: 0,
        },
        input: {
                flex: 1,
                color: COLORS.textPrimary,
                fontSize: EDIT_FONT,
                fontWeight: "400",
                lineHeight: EDIT_LINE,
                letterSpacing: 0.15,
                padding: 0,
                paddingTop: 6,
                textAlignVertical: "top",
        },
});

const dropS = StyleSheet.create({
        overlay: {
                ...StyleSheet.absoluteFillObject,
                backgroundColor: "rgba(6,6,7,0.85)",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 200,
        },
        box: {
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: "rgba(155,198,255,0.5)",
                borderRadius: 22,
                backgroundColor: "rgba(10,10,12,0.92)",
                paddingVertical: 46,
                paddingHorizontal: 70,
                shadowColor: "#000",
                shadowOpacity: 0.6,
                shadowRadius: 30,
                elevation: 30,
        },
        text: {
                fontFamily: "Courier New",
                fontSize: 13,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(210,226,255,0.7)",
        },
});
