/**
 * Structural copy of `@frak-labs/core-sdk`'s `FrakEnvironment`, which is the
 * source of truth. Not imported: this directory is shared between two example
 * apps without being a workspace package of its own, so it resolves no
 * dependencies.
 */
type FrakEnvironment = "prod" | "dev" | { wallet: string; backend: string };

/**
 * Resolve the `env` to hand to the Frak SDK.
 *
 * Remote runs just name a stage. Local runs probe the wallet dev server
 * (Tauri on http:3010, browser on https:3000) and pair whatever answers with
 * the local backend on :3030.
 */
export async function detectFrakEnv(
    useLocal: boolean,
    remoteEnv: FrakEnvironment = "dev"
): Promise<FrakEnvironment> {
    if (!useLocal) {
        return remoteEnv;
    }

    const localBackend = "https://localhost:3030";
    const cacheKey = "frak-wallet-url";

    const probe = (url: string) =>
        new Promise<string>((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = "";
                reject();
            }, 1500);
            img.onload = () => {
                clearTimeout(timeout);
                if (img.naturalWidth > 0) {
                    resolve(url);
                } else {
                    reject();
                }
            };
            img.onerror = () => {
                clearTimeout(timeout);
                reject();
            };
            img.src = `${url}/favicon.ico?_=${Date.now()}`;
        });

    // Check cached URL first, but validate it's still reachable
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            await probe(cached);
            console.log("[Frak SDK] Using cached wallet URL:", cached);
            return { wallet: cached, backend: localBackend };
        } catch {
            localStorage.removeItem(cacheKey);
        }
    }

    // Probe Tauri (http:3010) first, then browser (https:3000)
    const urls = ["http://localhost:3010", "https://localhost:3000"];
    for (const url of urls) {
        try {
            await probe(url);
            localStorage.setItem(cacheKey, url);
            console.log("[Frak SDK] Detected wallet URL:", url);
            return { wallet: url, backend: localBackend };
        } catch {}
    }

    console.warn(
        "[Frak SDK] Could not detect local wallet server. Falling back to https://localhost:3000. Make sure wallet dev server is running."
    );
    return { wallet: "https://localhost:3000", backend: localBackend };
}
