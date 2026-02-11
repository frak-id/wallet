export async function detectWalletUrl(
    useLocal: boolean,
    remoteUrl = "https://wallet-dev.frak.id"
): Promise<string> {
    if (!useLocal) {
        return remoteUrl;
    }

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
            return cached;
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
            return url;
        } catch {}
    }

    console.warn(
        "[Frak SDK] Could not detect local wallet server. Falling back to https://localhost:3000. Make sure wallet dev server is running."
    );
    return "https://localhost:3000";
}
