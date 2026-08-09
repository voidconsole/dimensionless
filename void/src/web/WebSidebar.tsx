// src/web/WebSidebar.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLORS, FONTS } from "../theme/index";
import { useNoteStore } from "../store/useNoteStore";

type IconName = React.ComponentProps<typeof Feather>["name"];

export interface SidebarRoute {
        id: string;
        icon: IconName;
        label: string;
}

const ROUTES: SidebarRoute[] = [
        { id: "Capture", icon: "edit-3", label: "Capture" },
        { id: "Log", icon: "list", label: "Log" },
        { id: "Settings", icon: "settings", label: "Settings" },
];

export function WebSidebar({
        active,
        onSelect,
}: {
        active: string;
        onSelect: (id: string) => void;
}) {
        const notes = useNoteStore((s) => s.notes);
        const unsynced = notes.filter((n) => !n.synced).length;

        return (
                <View style={s.rail}>
                        <View style={s.wordmark}>
                                <Text style={s.wordmarkText}>VOID</Text>
                                <View style={s.wordmarkRule} />
                        </View>

                        <View style={s.nav}>
                                {ROUTES.map((r) => {
                                        const isActive = active === r.id;
                                        return (
                                                <Pressable
                                                        key={r.id}
                                                        onPress={() =>
                                                                onSelect(r.id)
                                                        }
                                                        accessibilityRole="button"
                                                        style={[
                                                                s.item,
                                                                isActive &&
                                                                        s.itemActive,
                                                        ]}
                                                >
                                                        <Feather
                                                                name={r.icon}
                                                                size={17}
                                                                color={
                                                                        isActive
                                                                                ? "rgba(210,226,255,0.9)"
                                                                                : "rgba(255,255,255,0.28)"
                                                                }
                                                        />
                                                        <Text
                                                                style={[
                                                                        s.itemLabel,
                                                                        isActive &&
                                                                                s.itemLabelActive,
                                                                ]}
                                                        >
                                                                {r.label}
                                                        </Text>
                                                        {r.id === "Log" &&
                                                                notes.length >
                                                                        0 && (
                                                                        <Text
                                                                                style={
                                                                                        s.itemMeta
                                                                                }
                                                                        >
                                                                                {
                                                                                        notes.length
                                                                                }
                                                                        </Text>
                                                                )}
                                                </Pressable>
                                        );
                                })}
                        </View>

                        <View style={s.foot}>
                                <View style={s.footerRow}>
                                        <View
                                                style={[
                                                        s.footerDot,
                                                        {
                                                                backgroundColor:
                                                                        unsynced >
                                                                        0
                                                                                ? COLORS.accentBlue
                                                                                : COLORS.success,
                                                        },
                                                ]}
                                        />
                                        <Text style={s.footerText}>
                                                {unsynced > 0
                                                        ? `${unsynced} unsynced`
                                                        : "all synced"}
                                        </Text>
                                </View>
                        </View>
                </View>
        );
}

const s = StyleSheet.create({
        rail: {
                width: 252,
                backgroundColor: "#0a0a0b",
                borderLeftWidth: 0.5,
                borderLeftColor: "rgba(255,255,255,0.06)",
                paddingHorizontal: 16,
                paddingVertical: 24,
                justifyContent: "space-between",
        },
        wordmark: {
                paddingHorizontal: 8,
                paddingBottom: 22,
                borderBottomWidth: 0.5,
                borderBottomColor: "rgba(255,255,255,0.06)",
                marginBottom: 16,
        },
        wordmarkText: {
                fontFamily: "Courier New",
                fontSize: 11,
                letterSpacing: 6,
                color: "rgba(255,255,255,0.4)",
        },
        wordmarkRule: {
                marginTop: 10,
                width: 22,
                height: 2,
                borderRadius: 1,
                backgroundColor: "rgba(155,198,255,0.35)",
        },
        nav: {
                flex: 1,
                gap: 6,
        },
        item: {
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
        },
        itemActive: {
                backgroundColor: "rgba(155,198,255,0.07)",
        },
        itemLabel: {
                flex: 1,
                fontSize: 13.5,
                fontWeight: "500",
                letterSpacing: 0.2,
                color: "rgba(255,255,255,0.45)",
        },
        itemLabelActive: {
                color: "rgba(230,240,255,0.92)",
        },
        itemMeta: {
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: "rgba(255,255,255,0.25)",
        },
        foot: {
                paddingTop: 18,
                borderTopWidth: 0.5,
                borderTopColor: "rgba(255,255,255,0.06)",
                paddingHorizontal: 8,
        },
        footerRow: {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
        },
        footerText: {
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: 0.5,
                color: "rgba(255,255,255,0.3)",
        },
        footerDot: {
                width: 5,
                height: 5,
                borderRadius: 3,
        },
});