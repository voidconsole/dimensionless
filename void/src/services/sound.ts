// src/services/sound.ts
// Synthesized UI feedback sounds — no audio assets needed.
import { Audio } from "expo-av";

let enabled = true;

export function setSoundEnabled(v: boolean) {
        enabled = v;
}

function writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
        }
}

function makeWav(
        tones: Array<[number, number]>,
        volume = 0.28,
): string {
        const sampleRate = 22050;
        const totalMs = tones.reduce((acc, [, dur]) => acc + dur, 0);
        const n = Math.max(1, Math.floor((sampleRate * totalMs) / 1000));
        const bytesPerSample = 2;
        const dataSize = n * bytesPerSample;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        writeString(view, 0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, "WAVE");
        writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * bytesPerSample, true);
        view.setUint16(32, bytesPerSample, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, "data");
        view.setUint32(40, dataSize, true);

        let offsetMs = 0;
        for (const [freq, dur] of tones) {
                const start = Math.floor((offsetMs * sampleRate) / 1000);
                const count = Math.floor((dur * sampleRate) / 1000);
                for (let i = 0; i < count && start + i < n; i++) {
                        const t = (start + i) / sampleRate;
                        const attack = Math.min(1, i / (sampleRate * 0.005));
                        const release = Math.min(
                                1,
                                (count - i) / (sampleRate * 0.06),
                        );
                        const env = Math.min(attack, release, 1);
                        const v =
                                Math.sin(2 * Math.PI * freq * t) * env * volume;
                        view.setInt16(
                                44 + (start + i) * bytesPerSample,
                                Math.max(-1, Math.min(1, v)) * 0x7fff,
                                true,
                        );
                }
                offsetMs += dur;
        }

        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
        }
        return `data:audio/wav;base64,${btoa(binary)}`;
}

const popUri = makeWav([[880, 70]]);
const tapUri = makeWav([[520, 45]], 0.2);
const successUri = makeWav(
        [
                [660, 90],
                [880, 120],
        ],
        0.26,
);
const errorUri = makeWav(
        [
                [220, 140],
                [170, 180],
        ],
        0.24,
);

async function play(uri: string): Promise<void> {
        if (!enabled) return;
        try {
                const { sound } = await Audio.Sound.createAsync(
                        { uri },
                        { shouldPlay: true, volume: 1 },
                );
                sound.setOnPlaybackStatusUpdate((status) => {
                        if (status.isLoaded && status.didJustFinish) {
                                sound.unloadAsync().catch(() => {});
                        }
                });
        } catch {
                // sound is optional polish
        }
}

export const playPop = () => play(popUri);
export const playTap = () => play(tapUri);
export const playSuccess = () => play(successUri);
export const playError = () => play(errorUri);
