import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";
import type { VoidNote, Attachment } from "../services/github";

const storage = new MMKV({ id: "void-store-v2" });
const mmkvStorage = {
        getItem: (key: string) => storage.getString(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
};

interface NoteStore {
        notes: VoidNote[];
        addNote: (note: VoidNote) => void;
        updateNote: (id: string, patch: Partial<VoidNote>) => void;
        removeNote: (id: string) => void;
        mergeRemoteNotes: (remoteNotes: VoidNote[]) => void;
        clearAll: () => void;
}

function migrateNote(n: any): VoidNote {
        if (n && Array.isArray(n.labels) && n.labels.length) return n as VoidNote;
        const categoryId = n?.categoryId ?? "";
        const labels =
                categoryId === "void" || !categoryId
                        ? []
                        : [`void:${categoryId}`];
        return { ...(n as VoidNote), labels };
}

export const useNoteStore = create<NoteStore>()(
        persist(
                (set, get) => ({
                        notes: [],

                        addNote: (note) =>
                                set((state) => ({
                                        notes: [note, ...state.notes],
                                })),

                        updateNote: (id, patch) =>
                                set((state) => ({
                                        notes: state.notes.map((n) =>
                                                n.id === id
                                                        ? { ...n, ...patch }
                                                        : n,
                                        ),
                                })),

                        removeNote: (id) =>
                                set((state) => ({
                                        notes: state.notes.filter(
                                                (n) => n.id !== id,
                                        ),
                                })),

                        mergeRemoteNotes: (remoteNotes) => {
                                set((state) => {
                                        const localIds = new Set(
                                                state.notes.map((n) =>
                                                        n.issueNumber?.toString(),
                                                ),
                                        );
                                        const newRemote = remoteNotes.filter(
                                                (r) =>
                                                        !localIds.has(
                                                                r.issueNumber?.toString(),
                                                        ),
                                        );
                                        return {
                                                notes: [
                                                        ...state.notes,
                                                        ...newRemote,
                                                ],
                                        };
                                });
                        },

                        clearAll: () => set({ notes: [] }),
                }),
                {
                        name: "void-notes-v2",
                        storage: createJSONStorage(() => mmkvStorage),
                        merge: (persisted, current) => {
                                const p = persisted as {
                                        state?: { notes?: any[] };
                                };
                                const notes = (p?.state?.notes ?? []).map(
                                        migrateNote,
                                );
                                return { ...current, notes };
                        },
                },
        ),
);

export function createNote(
        title: string,
        text: string,
        labels: string[],
        attachments: Attachment[],
): VoidNote {
        return {
                id: `void_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text,
                title: title.trim() || "",
                labels,
                categoryId: labels[0] ?? "",
                attachments,
                createdAt: new Date().toISOString(),
                synced: false,
        };
}
