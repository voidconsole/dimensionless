import React, { useState, useCallback, useRef } from "react";
import {
        View,
        Text,
        ScrollView,
        TouchableOpacity,
        StyleSheet,
        RefreshControl,
        Platform,
} from "react-native";
import Animated, {
        useSharedValue,
        useAnimatedStyle,
        withSpring,
        withTiming,
        withSequence,
        FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { COLORS, FONTS, SPRING } from "../theme/index";
import { NoteCard } from "../components/NoteCard";
import { useNoteStore } from "../store/useNoteStore";
import { useLabelStore } from "../store/useLabelStore";
import { fetchRemoteNotes } from "../services/github";
import { useHaptic } from "../hooks/useHaptic";
import { Feather } from "@expo/vector-icons";

function FilterPill({
        label,
        active,
        color,
        onPress,
}: {
        label: string;
        active: boolean;
        color?: string;
        onPress: () => void;
}) {
        const scale = useSharedValue(1);
        const activeVal = useSharedValue(active ? 1 : 0);

        React.useEffect(() => {
                activeVal.value = withTiming(active ? 1 : 0, { duration: 200 });
        }, [active]);

        const animStyle = useAnimatedStyle(() => ({
                transform: [{ scale: scale.value }],
                backgroundColor: activeVal.value > 0.5
                        ? "rgba(255,255,255,0.06)"
                        : "transparent",
                borderColor: activeVal.value > 0.5
                        ? "rgba(255,255,255,0.14)"
                        : "rgba(255,255,255,0.06)",
        }));

        const textStyle = useAnimatedStyle(() => ({
                color: activeVal.value > 0.5
                        ? "rgba(255,255,255,0.78)"
                        : "rgba(255,255,255,0.28)",
        }));

        const handlePress = () => {
                scale.value = withSequence(
                        withSpring(0.9, { damping: 14, stiffness: 500 }),
                        withSpring(1, SPRING.snappy),
                );
                onPress();
        };

        return (
                <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
                        <Animated.View style={[s.filterPill, animStyle]}>
                                {color && (
                                        <View style={[s.filterDot, { backgroundColor: color }]} />
                                )}
                                <Animated.Text style={[s.filterLabel, textStyle]}>
                                        {label}
                                </Animated.Text>
                        </Animated.View>
                </TouchableOpacity>
        );
}

export function LogScreen() {
        const insets = useSafeAreaInsets();
        const { notes, removeNote, mergeRemoteNotes } = useNoteStore();
        const { labels } = useLabelStore();
        const { light } = useHaptic();
        const [filter, setFilter] = useState<string>("all");
        const [refreshing, setRefreshing] = useState(false);
        const lastFetchRef = useRef(0);

        const filtered = notes
                .filter((n) => {
                        if (filter === "all") return true;
                        return (n.labels ?? []).includes(filter);
                })
                .sort(
                        (a, b) =>
                                new Date(b.createdAt).getTime() -
                                new Date(a.createdAt).getTime(),
                );

        const refresh = useCallback(async () => {
                const now = Date.now();
                if (now - lastFetchRef.current < 30_000) return;
                lastFetchRef.current = now;
                setRefreshing(true);
                light();
                try {
                        const remote = await fetchRemoteNotes(
                                filter === "all" ? undefined : filter,
                        );
                        if (remote.length > 0) mergeRemoteNotes(remote);
                } catch {}
                setRefreshing(false);
        }, [filter]);

        useFocusEffect(
                useCallback(() => {
                        refresh();
                }, [refresh]),
        );

        const labelItems = labels;

        return (
                <View style={[s.screen, { paddingTop: insets.top }]}>
                        <View style={s.header}>
                                <Text style={s.title}>the void</Text>
                                <View style={s.headerRight}>
                                        <Text style={s.subtitle}>
                                                {notes.length} thought
                                                {notes.length !== 1 ? "s" : ""}
                                        </Text>
                                        {Platform.OS === "web" && (
                                                <TouchableOpacity
                                                        onPress={refresh}
                                                        hitSlop={8}
                                                        style={s.syncBtn}
                                                >
                                                        <Feather
                                                                name="refresh-cw"
                                                                size={13}
                                                                color="rgba(255,255,255,0.35)"
                                                        />
                                                </TouchableOpacity>
                                        )}
                                </View>
                        </View>

                        <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={s.filters}
                                keyboardShouldPersistTaps="handled"
                        >
                                <FilterPill
                                        label="all"
                                        active={filter === "all"}
                                        onPress={() => {
                                                light();
                                                setFilter("all");
                                        }}
                                />
                                {labelItems.map((label) => (
                                        <FilterPill
                                                key={label.name}
                                                label={label.name}
                                                active={filter === label.name}
                                                color={`#${label.color}`}
                                                onPress={() => {
                                                        light();
                                                        setFilter(label.name);
                                                }}
                                        />
                                ))}
                        </ScrollView>

                        <ScrollView
                                style={s.scroll}
                                contentContainerStyle={s.list}
                                showsVerticalScrollIndicator={false}
                                refreshControl={
                                        <RefreshControl
                                                refreshing={refreshing}
                                                onRefresh={refresh}
                                                tintColor="rgba(255,255,255,0.15)"
                                                colors={["rgba(210,226,255,0.6)"]}
                                                progressViewOffset={10}
                                        />
                                }
                        >
                                {filtered.length === 0 ? (
                                        <Animated.View
                                                entering={FadeInDown.duration(500).springify().damping(18)}
                                                style={s.empty}
                                        >
                                                <Feather
                                                        name="inbox"
                                                        size={30}
                                                        color="rgba(255,255,255,0.1)"
                                                />
                                                <Text style={s.emptyText}>
                                                        {filter === "all"
                                                                ? "nothing captured yet"
                                                                : "nothing in this label"}
                                                </Text>
                                                <Text style={s.emptyHint}>
                                                        pull to sync from github
                                                </Text>
                                        </Animated.View>
                                ) : (
                                        filtered.map((note, i) => (
                                                <NoteCard
                                                        key={note.id}
                                                        note={note}
                                                        index={i}
                                                        onDelete={removeNote}
                                                />
                                        ))
                                )}
                                <View style={{ height: insets.bottom + 20 }} />
                        </ScrollView>
                </View>
        );
}

const s = StyleSheet.create({
        screen: { flex: 1, backgroundColor: COLORS.void },
        header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10 },
        headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
        syncBtn: {
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
        },
        title: {
                fontSize: 22,
                fontWeight: "600",
                color: COLORS.textPrimary,
                letterSpacing: -0.5,
                lineHeight: 26,
        },
        subtitle: {
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: "rgba(255,255,255,0.2)",
                letterSpacing: 2,
                marginTop: 5,
        },
        filters: {
                flexDirection: "row",
                gap: 5,
                paddingHorizontal: 16,
                paddingBottom: 12,
        },
        filterPill: {
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 100,
                borderWidth: 0.5,
        },
        filterDot: { width: 4, height: 4, borderRadius: 2, opacity: 0.72 },
        filterLabel: {
                fontSize: 11,
                fontWeight: "500",
                letterSpacing: 0.3,
        },
        scroll: { flex: 1 },
        list: { paddingHorizontal: 14, paddingTop: 4 },
        empty: { alignItems: "center", paddingTop: 80, gap: 10 },
        emptyText: {
                fontSize: 14,
                color: "rgba(255,255,255,0.2)",
                letterSpacing: 0.3,
        },
        emptyHint: {
                fontSize: 11,
                fontFamily: FONTS.mono,
                color: "rgba(255,255,255,0.1)",
                letterSpacing: 0.5,
        },
});