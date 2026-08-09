import React, { useState, useEffect } from "react";
import {
        View,
        Text,
        TextInput,
        StyleSheet,
        ScrollView,
        TouchableOpacity,
        ActivityIndicator,
        Alert,
        Linking,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { COLORS, FONTS } from "../theme/index";
import {
        loadGitHubConfig,
        saveGitHubConfig,
        testGitHubConfig,
        fetchRepoLabels,
        GitHubConfig,
} from "../services/github";
import { useNoteStore } from "../store/useNoteStore";
import { useLabelStore } from "../store/useLabelStore";
import { useHaptic } from "../hooks/useHaptic";

type Status = "idle" | "testing" | "ok" | "error";

function Field({
        label,
        value,
        onChange,
        placeholder,
        secure,
        hint,
}: {
        label: string;
        value: string;
        onChange: (v: string) => void;
        placeholder?: string;
        secure?: boolean;
        hint?: string;
}) {
        return (
                <View style={fS.wrap}>
                        <Text style={fS.label}>{label}</Text>
                        <TextInput
                                value={value}
                                onChangeText={onChange}
                                placeholder={placeholder ?? ""}
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                secureTextEntry={secure}
                                style={fS.input}
                                autoCapitalize="none"
                                autoCorrect={false}
                                spellCheck={false}
                                keyboardAppearance="dark"
                                selectionColor={COLORS.caret}
                        />
                        {hint && <Text style={fS.hint}>{hint}</Text>}
                </View>
        );
}

const fS = StyleSheet.create({
        wrap: { marginBottom: 16 },
        label: {
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                color: "rgba(255,255,255,0.3)",
                marginBottom: 7,
                textTransform: "uppercase",
        },
        input: {
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                color: COLORS.textPrimary,
                fontSize: 14,
                letterSpacing: 0.2,
        },
        hint: {
                fontSize: 11,
                color: "rgba(255,255,255,0.22)",
                marginTop: 5,
                lineHeight: 16,
        },
});

export function SettingsScreen() {
        const insets = useSafeAreaInsets();
        const { success, error: hapticErr, light } = useHaptic();
        const { clearAll, notes } = useNoteStore();
        const { labels, setLabels } = useLabelStore();

        const [token, setToken] = useState("");
        const [owner, setOwner] = useState("");
        const [repo, setRepo] = useState("");
        const [status, setStatus] = useState<Status>("idle");
        const [statusMsg, setStatusMsg] = useState("");
        const [rateLimit, setRateLimit] = useState<number | null>(null);
        const [syncLabels, setSyncLabels] = useState(false);
        const [cfgOwner, setCfgOwner] = useState("");
        const [cfgRepo, setCfgRepo] = useState("");

        useEffect(() => {
                loadGitHubConfig().then(async (cfg) => {
                        if (cfg) {
                                setToken(cfg.token);
                                setOwner(cfg.owner);
                                setRepo(cfg.repo);
                                setCfgOwner(cfg.owner);
                                setCfgRepo(cfg.repo);
                                setStatus("ok");
                                setStatusMsg("Connected");
                                const repoLabels = await fetchRepoLabels(cfg);
                                if (repoLabels.length > 0) {
                                        setLabels(repoLabels);
                                }
                        }
                });
        }, []);

        const handleConnect = async () => {
                if (!token.trim() || !owner.trim() || !repo.trim()) {
                        setStatus("error");
                        setStatusMsg("All three fields are required");
                        return;
                }
                setStatus("testing");
                setStatusMsg("Testing connection…");

                const cfg: GitHubConfig = {
                        token: token.trim(),
                        owner: owner.trim().toLowerCase(),
                        repo: repo.trim(),
                };
                const result = await testGitHubConfig(cfg);

                if (result.ok) {
                        await saveGitHubConfig(cfg);
                        setCfgOwner(cfg.owner);
                        setCfgRepo(cfg.repo);
                        // Fetch and apply labels from repo (as-is, no creation)
                        const repoLabels = await fetchRepoLabels(cfg);
                        if (repoLabels.length > 0) {
                                setLabels(repoLabels);
                        }
                        setStatus("ok");
                        setStatusMsg("Connected");
                        setRateLimit(result.rateLimit ?? null);
                        success();
                } else {
                        setStatus("error");
                        setStatusMsg(result.error ?? "Connection failed");
                        hapticErr();
                }
        };

        const handleSyncLabels = async () => {
                const cfg = await loadGitHubConfig();
                if (!cfg) return;
                setSyncLabels(true);
                try {
                        const repoLabels = await fetchRepoLabels(cfg);
                        if (repoLabels.length > 0) {
                                setLabels(repoLabels);
                                success();
                        }
                } catch {
                        hapticErr();
                } finally {
                        setSyncLabels(false);
                }
        };

        const handleClear = () => {
                Alert.alert(
                        "Clear all notes",
                        "This removes all locally stored notes. Notes already synced to GitHub Issues remain there.",
                        [
                                { text: "Cancel", style: "cancel" },
                                {
                                        text: "Clear",
                                        style: "destructive",
                                        onPress: () => {
                                                clearAll();
                                                light();
                                        },
                                },
                        ],
                );
        };

        const statusColor =
                status === "ok"
                        ? COLORS.success
                        : status === "error"
                          ? COLORS.errorRed
                          : "rgba(255,255,255,0.3)";

        const labelItems = labels;

        return (
                <View style={[s.screen, { paddingTop: insets.top }]}>
                        <ScrollView
                                contentContainerStyle={[
                                        s.scroll,
                                        { paddingBottom: insets.bottom + 32 },
                                ]}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                        >
                                {/* Header */}
                                <Animated.View
                                        entering={FadeInDown.delay(
                                                0,
                                        ).springify()}
                                        style={s.header}
                                >
                                        <Text style={s.title}>settings</Text>
                                        <Text style={s.subtitle}>VOID v2</Text>
                                </Animated.View>

                                {/* GitHub section */}
                                <Animated.View
                                        entering={FadeInDown.delay(
                                                60,
                                        ).springify()}
                                        style={s.section}
                                >
                                        <View style={s.sectionHeader}>
                                                <Text style={s.sectionTitle}>
                                                        GitHub Issues
                                                </Text>
                                                <TouchableOpacity
                                                        onPress={() =>
                                                                Linking.openURL(
                                                                        "https://github.com/settings/tokens/new?scopes=repo&description=VOID",
                                                                )
                                                        }
                                                >
                                                        <Text
                                                                style={
                                                                        s.sectionLink
                                                                }
                                                        >
                                                                get token →
                                                        </Text>
                                                </TouchableOpacity>
                                        </View>

                                        <Field
                                                label="Personal Access Token"
                                                value={token}
                                                onChange={setToken}
                                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                                secure
                                                hint="Needs 'repo' scope. Your token is stored securely on-device."
                                        />
                                        <Field
                                                label="Owner"
                                                value={owner}
                                                onChange={setOwner}
                                                placeholder="your-username"
                                                hint="Your GitHub username or organization name."
                                        />
                                        <Field
                                                label="Repository"
                                                value={repo}
                                                onChange={setRepo}
                                                placeholder="dimensionless"
                                                hint='The repo where issues will be created. Must already exist. Recommended: "dimensionless".'
                                        />

                                        {/* Status */}
                                        {status !== "idle" && (
                                                <View style={s.statusRow}>
                                                        {status ===
                                                        "testing" ? (
                                                                <ActivityIndicator
                                                                        size="small"
                                                                        color="rgba(255,255,255,0.3)"
                                                                />
                                                        ) : (
                                                                <View
                                                                        style={[
                                                                                s.statusDot,
                                                                                {
                                                                                        backgroundColor:
                                                                                                statusColor,
                                                                                },
                                                                        ]}
                                                                />
                                                        )}
                                                        <Text
                                                                style={[
                                                                        s.statusText,
                                                                        {
                                                                                color: statusColor,
                                                                        },
                                                                ]}
                                                        >
                                                                {statusMsg}
                                                        </Text>
                                                        {status === "ok" &&
                                                                rateLimit !==
                                                                        null && (
                                                                        <Text
                                                                                style={
                                                                                        s.rateLimit
                                                                                }
                                                                        >
                                                                                {" "}
                                                                                ·{" "}
                                                                                {
                                                                                        rateLimit
                                                                                }
                                                                                /5000
                                                                                req
                                                                                left
                                                                        </Text>
                                                                )}
                                                </View>
                                        )}

                                        <TouchableOpacity
                                                style={s.connectBtn}
                                                onPress={handleConnect}
                                                activeOpacity={0.8}
                                        >
                                                <Text style={s.connectBtnText}>
                                                        {status === "testing"
                                                                ? "testing…"
                                                                : status ===
                                                                    "ok"
                                                                  ? "reconnect"
                                                                  : "connect"}
                                                </Text>
                                        </TouchableOpacity>
                                </Animated.View>

                                {/* Labels from GitHub */}
                                <Animated.View
                                        entering={FadeInDown.delay(
                                                120,
                                        ).springify()}
                                        style={s.section}
                                >
                                        <Text style={s.sectionTitle}>
                                                Labels from Repo
                                        </Text>
                                        <Text
                                                style={[
                                                        s.hint,
                                                        { marginBottom: 12 },
                                                ]}
                                        >
                                                Labels are fetched exactly as
                                                they exist on GitHub. Attach any
                                                of them to a note before
                                                sending.
                                        </Text>
                                        {cfgOwner && cfgRepo && (
                                                <TouchableOpacity
                                                        style={s.githubLink}
                                                        onPress={() =>
                                                                Linking.openURL(
                                                                        `https://github.com/${cfgOwner}/${cfgRepo}/labels`,
                                                                )
                                                        }
                                                        activeOpacity={0.8}
                                                >
                                                        <Feather
                                                                name="external-link"
                                                                size={13}
                                                                color="rgba(155,198,255,0.85)"
                                                        />
                                                        <Text
                                                                style={
                                                                        s.githubLinkText
                                                                }
                                                        >
                                                                open labels on
                                                                GitHub
                                                        </Text>
                                                </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                                style={s.syncLabelsBtn}
                                                onPress={handleSyncLabels}
                                                activeOpacity={0.8}
                                        >
                                                {syncLabels ? (
                                                        <ActivityIndicator
                                                                size="small"
                                                                color="rgba(255,255,255,0.5)"
                                                        />
                                                ) : (
                                                        <Feather
                                                                name="refresh-cw"
                                                                size={14}
                                                                color="rgba(255,255,255,0.6)"
                                                        />
                                                )}
                                                <Text style={s.syncLabelsText}>
                                                        {syncLabels
                                                                ? "syncing…"
                                                                : "re-fetch labels"}
                                                </Text>
                                        </TouchableOpacity>
                                        <View style={{ height: 8 }} />
                                        {labelItems.map((label) => (
                                                <View
                                                        key={label.name}
                                                        style={s.catRow}
                                                >
                                                        <View
                                                                style={[
                                                                        s.catDot,
                                                                        {
                                                                                backgroundColor:
                                                                                        `#${label.color}`,
                                                                        },
                                                                ]}
                                                        />
                                                        <View style={s.catBody}>
                                                                <Text
                                                                        style={
                                                                                s.catName
                                                                        }
                                                                >
                                                                        {
                                                                                label.name
                                                                        }
                                                                </Text>
                                                                <Text
                                                                        style={
                                                                                s.catDesc
                                                                        }
                                                                >
                                                                        {label.description ||
                                                                                "No description"}
                                                                </Text>
                                                        </View>
                                                </View>
                                        ))}
                                </Animated.View>

                                {/* Danger zone */}
                                <Animated.View
                                        entering={FadeInDown.delay(
                                                180,
                                        ).springify()}
                                        style={s.section}
                                >
                                        <Text style={s.sectionTitle}>
                                                Local Data
                                        </Text>
                                        <Text
                                                style={[
                                                        s.hint,
                                                        { marginBottom: 12 },
                                                ]}
                                        >
                                                {notes.length} note
                                                {notes.length !== 1 ? "s" : ""}{" "}
                                                stored locally.
                                                {notes.filter((n) => !n.synced)
                                                        .length > 0 &&
                                                        ` ${notes.filter((n) => !n.synced).length} unsynced.`}
                                        </Text>
                                        <TouchableOpacity
                                                style={s.dangerBtn}
                                                onPress={handleClear}
                                                activeOpacity={0.8}
                                        >
                                                <Text style={s.dangerBtnText}>
                                                        clear local notes
                                                </Text>
                                        </TouchableOpacity>
                                </Animated.View>
                        </ScrollView>
                </View>
        );
}

const s = StyleSheet.create({
        screen: { flex: 1, backgroundColor: COLORS.void },
        scroll: { paddingHorizontal: 22 },
        header: { paddingTop: 12, paddingBottom: 20 },
        title: {
                fontSize: 22,
                fontWeight: "600",
                color: COLORS.textPrimary,
                letterSpacing: -0.5,
        },
        subtitle: {
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: 2,
                marginTop: 4,
        },
        section: {
                backgroundColor: "rgba(255,255,255,0.025)",
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: 18,
                marginBottom: 14,
        },
        sectionHeader: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
        },
        sectionTitle: {
                fontFamily: FONTS.mono,
                fontSize: 11,
                letterSpacing: 1.5,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
        },
        sectionLink: {
                fontSize: 12,
                color: COLORS.accentBlue,
                letterSpacing: 0.3,
        },
        hint: { fontSize: 12, color: "rgba(255,255,255,0.28)", lineHeight: 18 },
        statusRow: {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
        },
        statusDot: { width: 6, height: 6, borderRadius: 3 },
        statusText: {
                fontSize: 12,
                fontFamily: FONTS.mono,
                letterSpacing: 0.5,
        },
        rateLimit: {
                fontSize: 11,
                fontFamily: FONTS.mono,
                color: "rgba(255,255,255,0.2)",
        },
        connectBtn: {
                backgroundColor: "rgba(210,226,255,0.9)",
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
        },
        connectBtnText: {
                fontSize: 14,
                fontWeight: "600",
                color: "#06060a",
                letterSpacing: 0.3,
        },
        catRow: {
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingTop: 10,
                paddingBottom: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: "rgba(255,255,255,0.04)",
        },
        catDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
        catBody: { flex: 1 },
        catName: { fontSize: 13, color: COLORS.textSecondary, letterSpacing: 0.2 },
        catDesc: {
                fontSize: 11.5,
                color: "rgba(255,255,255,0.28)",
                marginTop: 3,
                lineHeight: 16,
        },
        githubLink: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                paddingVertical: 9,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: "rgba(155,198,255,0.25)",
                backgroundColor: "rgba(155,198,255,0.04)",
                marginBottom: 10,
        },
        githubLinkText: {
                fontSize: 12,
                color: "rgba(155,198,255,0.85)",
                letterSpacing: 0.2,
        },
        syncLabelsBtn: {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                paddingVertical: 9,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: "rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.03)",
        },
        syncLabelsText: {
                fontSize: 12,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 0.2,
        },
        dangerBtn: {
                borderWidth: 0.5,
                borderColor: "rgba(240,80,80,0.25)",
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                backgroundColor: "rgba(240,80,80,0.05)",
        },
        dangerBtnText: {
                fontSize: 13,
                color: "rgba(240,80,80,0.7)",
                letterSpacing: 0.3,
        },
});