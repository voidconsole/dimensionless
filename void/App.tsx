// App.tsx
import "react-native-gesture-handler";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
        NavigationContainer,
        DefaultTheme,
        type NavigationContainerRef,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { CaptureScreen } from "./src/screens/CaptureScreen";
import { LogScreen } from "./src/screens/LogScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { COLORS } from "./src/theme/index";
import { flushQueue, loadGitHubConfig, fetchRepoLabels } from "./src/services/github";
import { useLabelStore } from "./src/store/useLabelStore";
import { injectWebStyles } from "./src/web/styles";
import { WebSidebar } from "./src/web/WebSidebar";

const Tab = createBottomTabNavigator();

type RootTabParamList = {
        Capture: undefined;
        Log: undefined;
        Settings: undefined;
};
type TabName = keyof RootTabParamList;

type IconName = React.ComponentProps<typeof Feather>["name"];

function TabIcon({
        name,
        focused,
}: {
        name: IconName;
        focused: boolean;
}) {
        return (
                <View
                        style={{
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                        }}
                >
                        <Feather
                                name={name}
                                size={21}
                                color={
                                        focused
                                                ? "rgba(210,226,255,0.9)"
                                                : "rgba(255,255,255,0.2)"
                                }
                        />
                        <View
                                style={{
                                        width: 3,
                                        height: 3,
                                        borderRadius: 2,
                                        backgroundColor: focused
                                                ? "rgba(210,226,255,0.7)"
                                                : "transparent",
                                        marginTop: 1,
                                }}
                        />
                </View>
        );
}

const VoidNav = {
        ...DefaultTheme,
        colors: {
                ...DefaultTheme.colors,
                background: COLORS.void,
                card: COLORS.void,
                border: "rgba(255,255,255,0.07)",
                text: "rgba(255,255,255,0.88)",
                primary: COLORS.caret,
                notification: COLORS.caret,
        },
};

export default function App() {
        const setLabels = useLabelStore((s) => s.setLabels);
        const labelCount = useLabelStore((s) => s.labels.length);

        useEffect(() => {
                if (Platform.OS === "web") {
                        injectWebStyles();
                }
        }, []);

        useEffect(() => {
                flushQueue().catch(() => {});
                if (labelCount === 0) {
                        loadGitHubConfig()
                                .then(async (cfg) => {
                                        if (!cfg) return;
                                        const repoLabels =
                                                await fetchRepoLabels(cfg);
                                        if (repoLabels.length > 0) {
                                                setLabels(repoLabels);
                                        }
                                })
                                .catch(() => {});
                }
        }, [labelCount]);

        const navRef = useRef<NavigationContainerRef<RootTabParamList>>(null);
        const [route, setRoute] = useState<TabName>("Capture");

        const onStateChange = useCallback(() => {
                const r = navRef.current?.getCurrentRoute();
                if (r && r.name !== "Capture" && r.name !== "Log" && r.name !== "Settings") return;
                setRoute(r?.name as TabName);
        }, []);

        const tabBarStyle = Platform.OS === "web"
                ? { display: "none" as const }
                : {
                          backgroundColor: "rgba(6,6,7,0.97)",
                          borderTopWidth: 0.5,
                          borderTopColor: "rgba(255,255,255,0.07)",
                          height: Platform.OS === "ios" ? 62 : 60,
                          paddingBottom: Platform.OS === "android" ? 8 : 6,
                          paddingTop: 8,
                  };

        const goTab = useCallback((name: string) => {
                navRef.current?.navigate(name as TabName);
        }, []);

        return (
                <GestureHandlerRootView style={{ flex: 1 }}>
                        <SafeAreaProvider>
                                <StatusBar style="light" />
                                <View
                                        style={{
                                                flex: 1,
                                                backgroundColor: COLORS.void,
                                                flexDirection:
                                                        Platform.OS === "web"
                                                                ? "row"
                                                                : "column",
                                        }}
                                >
                                        <View
                                                style={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        backgroundColor:
                                                                COLORS.void,
                                                }}
                                        >
                                                <NavigationContainer
                                                        ref={navRef}
                                                        theme={VoidNav}
                                                        onStateChange={
                                                                onStateChange
                                                        }
                                                >
                                        <Tab.Navigator
                                                screenOptions={{
                                                        headerShown: false,
                                                        tabBarStyle,
                                                        tabBarShowLabel: false,
                                                        tabBarActiveTintColor:
                                                                "rgba(210,226,255,0.9)",
                                                        tabBarInactiveTintColor:
                                                                "rgba(255,255,255,0.2)",
                                                }}
                                        >
                                                <Tab.Screen
                                                        name="Capture"
                                                        component={
                                                                CaptureScreen
                                                        }
                                                        options={{
                                                                tabBarIcon: ({
                                                                        focused,
                                                                }) => (
                                                                        <TabIcon
                                                                                name="edit-3"
                                                                                focused={
                                                                                        focused
                                                                                }
                                                                        />
                                                                ),
                                                        }}
                                                />
                                                <Tab.Screen
                                                        name="Log"
                                                        component={LogScreen}
                                                        options={{
                                                                tabBarIcon: ({
                                                                        focused,
                                                                }) => (
                                                                        <TabIcon
                                                                                name="list"
                                                                                focused={
                                                                                        focused
                                                                                }
                                                                        />
                                                                ),
                                                        }}
                                                />
                                                <Tab.Screen
                                                        name="Settings"
                                                        component={
                                                                SettingsScreen
                                                        }
                                                        options={{
                                                                tabBarIcon: ({
                                                                        focused,
                                                                }) => (
                                                                        <TabIcon
                                                                                name="settings"
                                                                                focused={
                                                                                        focused
                                                                                }
                                                                        />
),
                                                                }}
                                                        />
                                                </Tab.Navigator>
                                                </NavigationContainer>
                                        </View>
                                        {Platform.OS === "web" && (
                                                <WebSidebar
                                                        active={route}
                                                        onSelect={goTab}
                                                />
                                        )}
                                </View>
                        </SafeAreaProvider>
                </GestureHandlerRootView>
        );
}
