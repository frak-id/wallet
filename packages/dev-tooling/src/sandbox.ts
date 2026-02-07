type AtelierWellKnown = {
    routes?: {
        dev?: { named?: Record<string, string>; default?: string };
    };
};
async function getAtelierWellKnown(): Promise<AtelierWellKnown | null> {
    const sandboxId = process.env.ATELIER_SANDBOX_ID;
    if (!sandboxId) return null;
    const base =
        process.env.ATELIER_MANAGER_INTERNAL_URL ??
        "http://172.16.0.1:4000/internal";
    const url = `${base}/.well-known/atelier.json?sandboxId=${sandboxId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as AtelierWellKnown;
}

export async function getSandboxEnv() {
    const wk = await getAtelierWellKnown();

    const backendUrl =
        wk?.routes?.dev?.named?.["wallet-backend"] ??
        process.env.BACKEND_URL ??
        "https://backend.gcp-dev.frak.id";
    const walletUrl =
        wk?.routes?.dev?.named?.wallet ??
        wk?.routes?.dev?.default ??
        process.env.FRAK_WALLET_URL ??
        "https://wallet-dev.frak.id";

    return {
        backendUrl,
        walletUrl,
    };
}
