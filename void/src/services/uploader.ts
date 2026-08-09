// src/services/uploader.ts
// VOID × Catbox — Anonymous file persistence

function timeoutSignal(ms: number): AbortController {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller;
}

export async function uploadFile(
        uri: string,
        name: string,
        mimeType: string
): Promise<string | null> {
        try {
                const safeName = name
                        .replace(/[^\w.\-]+/g, "_")
                        .replace(/_+/g, "_")
                        .trim()
                        .slice(0, 80) || "file";
                const formData = new FormData();
                formData.append("reqtype", "fileupload");
                // React Native FormData accepts an object with uri, name, and type for files
                formData.append("fileToUpload", {
                        uri,
                        name: safeName,
                        type: mimeType || "application/octet-stream",
                } as any);

                const controller = timeoutSignal(120_000);
                const response = await fetch("https://catbox.moe/user/api.php", {
                        method: "POST",
                        body: formData,
                        signal: controller.signal,
                });

                if (!response.ok) {
                        console.error("[VOID] Upload failed:", response.status);
                        return null;
                }

                const url = (await response.text()).trim();
                if (!url.startsWith("http")) return null;
                return url;
        } catch (error) {
                console.error("[VOID] Upload error:", error);
                return null;
        }
}
