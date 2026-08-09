import { MMKV } from "react-native-mmkv";
import { getItemAsync, setItemAsync } from "./secureStore";
import { uploadFile } from "./uploader";
import { uploadToAssetsRepo } from "./assets";

const BASE = "https://api.github.com";
const qStore = new MMKV({ id: "void-gh-queue" });
const syncStore = new MMKV({ id: "void-gh-sync" });

export interface Attachment {
        id: string;
        type: "image" | "voice" | "file" | "video";
        uri: string;
        name: string;
        mimeType?: string;
        durationSecs?: number;
        uploadedUrl?: string;
}

export interface VoidNote {
        id: string;
        text: string;
        title?: string;
        labels: string[];
        categoryId?: string;
        attachments: Attachment[];
        createdAt: string;
        synced: boolean;
        issueNumber?: number;
        issueUrl?: string;
        syncError?: string;
}

export interface GitHubConfig {
        token: string;
        owner: string;
        repo: string;
}

export interface GitHubLabel {
        name: string;
        color: string;
        description: string;
}

export interface SyncResult {
        ok: boolean;
        error?: string;
        issueNumber?: number;
        issueUrl?: string;
}

export async function saveGitHubConfig(cfg: GitHubConfig): Promise<void> {
        await setItemAsync("gh_token", cfg.token.trim());
        await setItemAsync("gh_owner", cfg.owner.trim().toLowerCase());
        await setItemAsync("gh_repo", cfg.repo.trim());
}

export async function loadGitHubConfig(): Promise<GitHubConfig | null> {
        const [token, owner, repo] = await Promise.all([
                getItemAsync("gh_token"),
                getItemAsync("gh_owner"),
                getItemAsync("gh_repo"),
        ]);
        if (!token || !owner || !repo) return null;
        return { token, owner, repo };
}

export async function testGitHubConfig(
        cfg: GitHubConfig,
): Promise<{ ok: boolean; error?: string; rateLimit?: number }> {
        try {
                const res = await ghFetch(
                        `/repos/${cfg.owner}/${cfg.repo}`,
                        { method: "GET" },
                        cfg.token,
                );
                if (res.status === 404)
                        return {
                                ok: false,
                                error: "Repository not found. Check owner and repo name.",
                        };
                if (res.status === 401)
                        return {
                                ok: false,
                                error: "Token invalid or expired.",
                        };
                if (!res.ok)
                        return {
                                ok: false,
                                error: `GitHub returned ${res.status}`,
                        };
                const remaining = Number(
                        res.headers.get("x-ratelimit-remaining") ?? 5000,
                );
                return { ok: true, rateLimit: remaining };
        } catch (e: any) {
                return { ok: false, error: e?.message ?? "Network error" };
        }
}

async function ghFetch(
        path: string,
        options: RequestInit,
        token: string,
): Promise<Response> {
        return fetch(`${BASE}${path}`, {
                ...options,
                headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        "Content-Type": "application/json",
                        ...(options.headers ?? {}),
                },
        });
}

export async function fetchRepoLabels(
        cfg: GitHubConfig,
): Promise<GitHubLabel[]> {
        try {
                const res = await ghFetch(
                        `/repos/${cfg.owner}/${cfg.repo}/labels?per_page=100`,
                        { method: "GET" },
                        cfg.token,
                );
                if (!res.ok) return [];
                const labels = (await res.json()) as GitHubLabel[];
                return labels.filter((l) => typeof l.name === "string");
        } catch {
                return [];
        }
}

function truncate(s: string, max = 72): string {
        return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function buildTitle(note: VoidNote): string {
        const t = note.title?.trim();
        if (t) return truncate(t);
        const first = note.text.split("\n")[0].trim();
        if (first) return truncate(first);
        if (note.attachments.length > 0) {
                const a = note.attachments[0];
                if (a.type === "voice") {
                        const dur = a.durationSecs
                                ? ` (${Math.floor(a.durationSecs / 60)}:${String(a.durationSecs % 60).padStart(2, "0")})`
                                : "";
                        return `voice note${dur}`;
                }
                if (a.type === "image") return "image capture";
                return a.name;
        }
        return `Note — ${new Date(note.createdAt).toLocaleString()}`;
}

function contentText(note: VoidNote): string {
        const text = note.text ?? "";
        if (typeof note.title === "string") return text.trim();
        const lines = text.split("\n");
        lines.shift();
        return lines.join("\n").trim();
}

function attachmentMarkdown(a: Attachment, url: string | undefined): string {
        if (a.type === "image") {
                return url ? `![${a.name}](${url})` : `\`${a.name}\``;
        }
        if (a.type === "voice") {
                const dur = a.durationSecs
                        ? ` (${Math.floor(a.durationSecs / 60)}:${String(a.durationSecs % 60).padStart(2, "0")})`
                        : "";
                return url ? `[${a.name}${dur}](${url})` : `\`${a.name}\``;
        }
        return url ? `[${a.name}](${url})` : `\`${a.name}\``;
}

function footer(note: VoidNote): string {
        const ts = new Date(note.createdAt).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
        });
        return `---\n_${ts}_`;
}

function buildBody(note: VoidNote, urlMap: Record<string, string>): string {
        let body = contentText(note);

        const appended: string[] = [];
        for (const a of note.attachments) {
                const token = `{{att:${a.id}}}`;
                const md = attachmentMarkdown(a, urlMap[a.id]);
                if (body.includes(token)) {
                        body = body.split(token).join(md);
                } else {
                        appended.push(md);
                }
        }
        body = body.replace(/\{\{att:[^}]*\}\}/g, "");
        if (appended.length) {
                const extra = appended.join("\n\n");
                body = body.trim() ? `${body.trim()}\n\n${extra}` : extra;
        }

        const f = footer(note);
        return body.trim() ? `${body.trim()}\n\n${f}` : f;
}

function buildBaseBody(note: VoidNote): string {
        const body = contentText(note).replace(/\{\{att:[^}]*\}\}/g, "");
        const f = footer(note);
        return body.trim() ? `${body.trim()}\n\n${f}` : f;
}

async function uploadAttachments(
        cfg: GitHubConfig,
        note: VoidNote,
        issueNumber: number,
        commitMessage: string,
): Promise<Record<string, string>> {
        const map: Record<string, string> = {};
        await Promise.all(
                note.attachments.map(async (a) => {
                        if (a.uploadedUrl) {
                                map[a.id] = a.uploadedUrl;
                                return;
                        }
                        try {
                                const url = await uploadToAssetsRepo(
                                        cfg,
                                        a.uri,
                                        a.name,
                                        issueNumber,
                                        commitMessage,
                                );
                                map[a.id] = url;
                                a.uploadedUrl = url;
                                return;
                        } catch {
                                // fall back to catbox
                        }
                        const url = await uploadFile(
                                a.uri,
                                a.name,
                                a.mimeType ?? "application/octet-stream",
                        );
                        if (url) {
                                map[a.id] = url;
                                a.uploadedUrl = url;
                        }
                }),
        );
        return map;
}

async function resolveLabels(
        note: VoidNote,
        cfg: GitHubConfig,
): Promise<string[]> {
        const wanted = (note.labels ?? []).filter(Boolean);
        if (!wanted.length) {
                const legacy =
                        note.categoryId === "void" || !note.categoryId
                                ? []
                                : [`void:${note.categoryId}`];
                if (!legacy.length) return [];
                return verifyLabels(legacy, cfg);
        }
        return verifyLabels(wanted, cfg);
}

async function verifyLabels(
        wanted: string[],
        cfg: GitHubConfig,
): Promise<string[]> {
        try {
                const res = await ghFetch(
                        `/repos/${cfg.owner}/${cfg.repo}/labels?per_page=100`,
                        { method: "GET" },
                        cfg.token,
                );
                if (!res.ok) return wanted;
                const existing = new Set(
                        ((await res.json()) as any[]).map((l) => l.name),
                );
                return wanted.filter((n) => existing.has(n));
        } catch {
                return wanted;
        }
}

export async function syncNote(note: VoidNote): Promise<SyncResult> {
        const cfg = await loadGitHubConfig();
        if (!cfg?.token)
                return {
                        ok: false,
                        error: "GitHub not configured — open Settings",
                };

        const title = buildTitle(note);

        try {
                const labels = await resolveLabels(note, cfg);

                let res = await ghFetch(
                        `/repos/${cfg.owner}/${cfg.repo}/issues`,
                        {
                                method: "POST",
                                body: JSON.stringify({
                                        title,
                                        body: buildBaseBody(note),
                                        labels,
                                }),
                        },
                        cfg.token,
                );

                if (!res.ok && res.status === 422) {
                        res = await ghFetch(
                                `/repos/${cfg.owner}/${cfg.repo}/issues`,
                                {
                                        method: "POST",
                                        body: JSON.stringify({
                                                title,
                                                body: buildBaseBody(note),
                                        }),
                                },
                                cfg.token,
                        );
                }

                if (!res.ok) {
                        const bodyMsg = (await res
                                .json()
                                .catch(() => ({}))) as any;
                        return {
                                ok: false,
                                error: bodyMsg?.message ?? `GitHub ${res.status}`,
                        };
                }

                const issue = (await res.json()) as any;
                const issueNumber = issue.number;

                if (note.attachments.length > 0) {
                        const urlMap = await uploadAttachments(
                                cfg,
                                note,
                                issueNumber,
                                title,
                        );
                        await ghFetch(
                                `/repos/${cfg.owner}/${cfg.repo}/issues/${issueNumber}`,
                                {
                                        method: "PATCH",
                                        body: JSON.stringify({
                                                body: buildBody(note, urlMap),
                                        }),
                                },
                                cfg.token,
                        );
                }

                return {
                        ok: true,
                        issueNumber,
                        issueUrl: issue.html_url,
                };
        } catch (e: any) {
                return {
                        ok: false,
                        error: e?.message ?? "Network unavailable",
                };
        }
}

export function lastSyncedAt(): number {
        return Number(syncStore.getString("lastSyncAt") ?? 0);
}

export async function fetchRemoteNotes(
        labelName?: string,
): Promise<VoidNote[]> {
        const cfg = await loadGitHubConfig();
        if (!cfg) return [];

        const since = syncStore.getString("since");
        const params = new URLSearchParams({
                state: "open",
                per_page: "100",
                sort: "created",
                direction: "desc",
        });
        if (labelName) params.set("labels", labelName);
        if (since) params.set("since", since);

        try {
                const res = await ghFetch(
                        `/repos/${cfg.owner}/${cfg.repo}/issues?${params.toString()}`,
                        { method: "GET" },
                        cfg.token,
                );
                if (!res.ok) return [];
                const issues = (await res.json()) as any[];
                syncStore.set("since", new Date().toISOString());
                syncStore.set("lastSyncAt", String(Date.now()));
                return issues.map(issueToNote);
        } catch {
                return [];
        }
}

function issueToNote(issue: any): VoidNote {
        const labels: string[] = ((issue.labels ?? []) as any[])
                .map((l: any) => l?.name)
                .filter((n: any) => typeof n === "string");
        const body: string = issue.body ?? "";
        const text = body.replace(/\n*---\n_.*_$/s, "").trim();

        return {
                id: `gh_${issue.number}`,
                text,
                title: typeof issue.title === "string" ? issue.title : "",
                labels,
                categoryId:
                        labels.find((l) => l !== "void") ?? labels[0] ?? "",
                attachments: [],
                createdAt: issue.created_at,
                synced: true,
                issueNumber: issue.number,
                issueUrl: issue.html_url,
        };
}

function readQueue(): VoidNote[] {
        try {
                return JSON.parse(qStore.getString("q") ?? "[]");
        } catch {
                return [];
        }
}
function writeQueue(q: VoidNote[]): void {
        qStore.set("q", JSON.stringify(q));
}

export function enqueueNote(note: VoidNote): void {
        const q = readQueue();
        if (!q.find((n) => n.id === note.id)) q.push(note);
        writeQueue(q);
}

export async function flushQueue(): Promise<void> {
        const q = readQueue();
        if (!q.length) return;
        const remaining: VoidNote[] = [];
        for (const n of q) {
                const r = await syncNote(n);
                if (!r.ok) remaining.push(n);
        }
        writeQueue(remaining);
}

export async function captureNote(note: VoidNote): Promise<SyncResult> {
        const result = await syncNote(note);
        if (!result.ok) enqueueNote(note);
        return result;
}

export function stripAttachmentTokens(text: string): string {
        return (text ?? "").replace(/\{\{att:[^}]*\}\}/g, "");
}
