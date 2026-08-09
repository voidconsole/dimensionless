import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import type { GitHubLabel } from "../services/github";

const storage = new MMKV({ id: "void-labels-v2" });
const labelStorage = {
        getItem: (key: string) => storage.getString(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
};

interface LabelStore {
        labels: GitHubLabel[];
        setLabels: (labels: GitHubLabel[]) => void;
        getLabel: (name: string) => GitHubLabel | undefined;
        getCategoryColor: (labelName: string) => string;
}

function parseColor(color: string): string {
        return color.startsWith("#") ? color : `#${color}`;
}

export const useLabelStore = create<LabelStore>()(
        persist(
                (set, get) => ({
                        labels: [],

                        setLabels: (labels) => set({ labels }),

                        getLabel: (name) =>
                                get().labels.find((l) => l.name === name),

                        getCategoryColor: (labelName) => {
                                const found = get().labels.find(
                                        (l) => l.name === labelName,
                                );
                                if (found) return parseColor(found.color);
                                return "#888888";
                        },
                }),
                {
                        name: "void-labels-v2",
                        storage: createJSONStorage(() => labelStorage),
                },
        ),
);
