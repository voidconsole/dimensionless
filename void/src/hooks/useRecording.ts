// src/hooks/useRecording.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Audio } from "expo-av";

export function useRecording() {
        const recordingRef = useRef<Audio.Recording | null>(null);
        const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
        const [isRecording, setIsRecording] = useState(false);
        const [durationSecs, setDurationSecs] = useState(0);
        const [uri, setUri] = useState<string | null>(null);

        const start = useCallback(async () => {
                try {
                        const { granted } =
                                await Audio.requestPermissionsAsync();
                        if (!granted) return;
                        await Audio.setAudioModeAsync({
                                allowsRecordingIOS: true,
                                playsInSilentModeIOS: true,
                        });
                        const { recording } = await Audio.Recording.createAsync(
                                Audio.RecordingOptionsPresets.HIGH_QUALITY,
                        );
                        recordingRef.current = recording;
                        setIsRecording(true);
                        setDurationSecs(0);
                        setUri(null);
                        timerRef.current = setInterval(
                                () => setDurationSecs((s) => s + 1),
                                1000,
                        );
                } catch (e) {
                        console.error("[VOID] Record start:", e);
                }
        }, []);

        const stop = useCallback(async (): Promise<{
                uri: string;
                durationSecs: number;
        } | null> => {
                if (!recordingRef.current) return null;
                try {
                        clearInterval(timerRef.current!);
                        await recordingRef.current.stopAndUnloadAsync();
                        const recordedUri =
                                recordingRef.current.getURI() ?? null;
                        const secs = durationSecs;
                        recordingRef.current = null;
                        setIsRecording(false);
                        setUri(recordedUri);
                        await Audio.setAudioModeAsync({
                                allowsRecordingIOS: false,
                        });
                        return recordedUri
                                ? { uri: recordedUri, durationSecs: secs }
                                : null;
                } catch (e) {
                        console.error("[VOID] Record stop:", e);
                        return null;
                }
        }, [durationSecs]);

        useEffect(() => {
                return () => {
                        clearInterval(timerRef.current!);
                        recordingRef.current
                                ?.stopAndUnloadAsync()
                                .catch(() => {});
                };
        }, []);

        const formatted = `${String(Math.floor(durationSecs / 60)).padStart(2, "0")}:${String(durationSecs % 60).padStart(2, "0")}`;

        return { isRecording, durationSecs, uri, formatted, start, stop };
}
