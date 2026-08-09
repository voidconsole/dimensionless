// src/services/assets.ts
// Uploads VOID attachments to the {owner}/assets repository via the GitHub
// Contents API, then serves them through jsdelivr so images render in issues.
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { MMKV } from "react-native-mmkv";
import type { GitHubConfig } from "./github";

const ASSETS_REPO = "assets";
const cache = new MMKV({ id: "void-assets" });

const MAX_ASSETS_SIZE = 25 * 1024 * 1024;

async function ghApi(
        path: string,
        options: RequestInit,
        token: string,
): Promise<Response> {
        return fetch(`https://api.github.com${path}`, {
                ...options,
                headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/vnd.github+json",
                        "Content-Type": "application/json",
                        "X-GitHub-Api-Version": "2022-11-28",
                        ...(options.headers ?? {}),
                },
        });
}

export async function getAssetsBranch(cfg: GitHubConfig): Promise<string> {
        const cached = cache.getString("branch");
        if (cached) return cached;
        try {
                const res = await ghApi(
                        `/repos/${cfg.owner}/${ASSETS_REPO}`,
                        { method: "GET" },
                        cfg.token,
                );
                if (res.ok) {
                        const repo = (await res.json()) as any;
                        const branch = repo.default_branch || "main";
                        cache.set("branch", branch);
                        return branch;
                }
                if (res.status === 404) {
                        const createRes = await ghApi(
                                "/user/repos",
                                {
                                        method: "POST",
                                        body: JSON.stringify({
                                                name: ASSETS_REPO,
                                                description: "VOID attachments",
                                                auto_init: true,
                                                private: false,
                                        }),
                                },
                                cfg.token,
                        );
                        if (createRes.ok) {
                                cache.set("branch", "main");
                                return "main";
                        }
                }
        } catch {
                // fall through
        }
        throw new Error("assets repo unavailable");
}

function extFromName(name: string): string {
        const ext = name.split(".").pop();
        return ext && ext.length > 0 && ext.length <= 5 ? ext : "bin";
}

export function buildAssetsPath(
        issueNumber: number,
        name: string,
): string {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const folder = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
        const file = `${issueNumber}${Date.now()}.${extFromName(name)}`;
        return `${folder}/${file}`;
}

export function jsdelivrUrl(
        cfg: GitHubConfig,
        branch: string,
        relativePath: string,
): string {
        const encoded = relativePath
                .split("/")
                .map(encodeURIComponent)
                .join("/");
        return `https://cdn.jsdelivr.net/gh/${cfg.owner}/${ASSETS_REPO}@${branch}/${encoded}`;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
                binary += String.fromCharCode.apply(
                        null,
                        Array.from(bytes.subarray(i, i + chunk)),
                );
        }
        return btoa(binary);
}

async function readAsset(
        uri: string,
): Promise<{ size: number; base64: string }> {
        if (Platform.OS === "web") {
                const res = await fetch(uri);
                if (!res.ok) throw new Error("file missing");
                const buf = await res.arrayBuffer();
                return { size: buf.byteLength, base64: arrayBufferToBase64(buf) };
        }
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) throw new Error("file missing");
        const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
        });
        return { size: info.size ?? 0, base64 };
}

/**
 * Uploads a local file to the assets repo and returns a jsdelivr URL.
 * Throws on failure so the caller can fall back to catbox.
 */
export async function uploadToAssetsRepo(
        cfg: GitHubConfig,
        uri: string,
        name: string,
        issueNumber: number,
        commitMessage: string,
): Promise<string> {
        const branch = await getAssetsBranch(cfg);
        const relativePath = buildAssetsPath(issueNumber, name);

        const { size, base64 } = await readAsset(uri);
        if (size > MAX_ASSETS_SIZE) {
                throw new Error("file too large");
        }

        const apiPath = `/repos/${cfg.owner}/${ASSETS_REPO}/contents/${relativePath}`;

        const body: any = {
                message: commitMessage,
                content: base64,
                branch,
        };

        let res = await ghApi(
                apiPath,
                { method: "PUT", body: JSON.stringify(body) },
                cfg.token,
        );
        if (res.status === 422) {
                // collision on existing path: fetch sha and update
                const existing = await ghApi(
                        apiPath,
                        { method: "GET" },
                        cfg.token,
                );
                if (existing.ok) {
                        body.sha = ((await existing.json()) as any).sha;
                        res = await ghApi(
                                apiPath,
                                { method: "PUT", body: JSON.stringify(body) },
                                cfg.token,
                        );
                }
        }
        if (!res.ok) {
                throw new Error(`upload failed ${res.status}`);
        }

        return jsdelivrUrl(cfg, branch, relativePath);
}
