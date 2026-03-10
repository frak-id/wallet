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

    return {
        backendUrl: wk?.routes?.dev?.named?.["wallet-backend"],
        walletUrl: wk?.routes?.dev?.named?.wallet ?? wk?.routes?.dev?.default,
    };
}

/**
 * Read an SST resource value from the environment.
 *
 * Handles all SST injection modes:
 *  - Plain env var (Docker build args, `sst dev` DevCommand environment)
 *  - `SST_RESOURCE_*` JSON (secrets and Linkables exposed by `sst shell`)
 */
export function getSstResource(name: string): string | undefined {
    const plainValue = process.env[name];
    if (plainValue) return plainValue;

    const resourceValue = process.env[`SST_RESOURCE_${name}`];
    if (resourceValue) {
        try {
            const parsed = JSON.parse(resourceValue);
            return parsed.value;
        } catch {
            return undefined;
        }
    }

    return undefined;
}
