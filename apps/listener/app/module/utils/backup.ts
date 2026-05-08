import { base64urlDecode, base64urlEncode } from "@frak-labs/core-sdk";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common/utils/lifecycleEvents";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import type { SdkSession, Session } from "@frak-labs/wallet-shared/types";

/**
 * Represent backed up data
 */
type BackupData = {
    domain: string;
    session?: Session;
    sdkSession?: SdkSession;
    expireAtTimestamp: number;
};

/**
 * Backup data with hash validation
 */
type HashProtectedBackup = BackupData & { validationHash: string };

/**
 * Hash JSON data with SHA256 using the Web Crypto API.
 *
 * Output is byte-identical to `viem.sha256(new TextEncoder().encode(...))`
 * (`"0x" + 64 lowercase hex chars`) so existing customer backups continue to
 * validate without any migration. Replacing viem with `crypto.subtle.digest`
 * removes ~the entire viem chunk from the eager iframe bundle.
 *
 * @param data - Data to hash
 * @returns SHA256 hash as `0x`-prefixed lowercase hex string
 */
export async function hashJson(data: unknown): Promise<string> {
    const buf = new TextEncoder().encode(JSON.stringify(data));
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return `0x${Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`;
}

/**
 * Restore received backup data
 * @param backup
 * @param domain
 */
export async function restoreBackupData({
    backup,
    domain,
}: {
    backup: string;
    domain: string;
}) {
    let data: BackupData | undefined;
    try {
        // Decode base64url + JSON
        const decoded = JSON.parse(
            new TextDecoder().decode(base64urlDecode(backup))
        ) as HashProtectedBackup;

        // Extract and verify hash
        const { validationHash, ...backupData } = decoded;
        if ((await hashJson(backupData)) !== validationHash) {
            throw new Error("Invalid backup hash");
        }

        data = backupData;
    } catch (e) {
        console.error("[Backup] Failed to restore:", e);
        return;
    }

    // Ensure that the backup data is for the current domain
    if (data.domain !== domain) {
        throw new Error("Invalid backup data");
    }

    // If the backup is older than a week ago, ask to remove it and return
    if (data.expireAtTimestamp < Date.now()) {
        emitLifecycleEvent({
            iframeLifecycle: "remove-backup",
        });
        return;
    }

    // Restore all the data to stores
    if (data.session?.token) {
        sessionStore.getState().setSession(data.session);
    }
    if (data.sdkSession) {
        sessionStore.getState().setSdkSession(data.sdkSession);
    }
}

/**
 * Push new backup data
 */
export async function pushBackupData(args?: { domain?: string }) {
    // Get the domain from args (optional for cleanup scenarios)
    const domain = args?.domain;
    if (!domain) {
        console.log("[Backup] No domain provided - skipping backup");
        return;
    }
    // Get the current backup data from stores
    const sessionState = sessionStore.getState();

    const session = sessionState.session;
    const sdkSession = sessionState.sdkSession;

    // Build backup datas
    const backup: BackupData = {
        session: session?.token ? session : undefined,
        sdkSession: sdkSession?.token ? sdkSession : undefined,
        domain,
        // Backup will expire in a week
        expireAtTimestamp: Date.now() + 7 * 24 * 60 * 60_000,
    };
    console.log("[Backup] Pushing new backup data to parent client", {
        backup,
    });

    // If nothing to back up, just remove it
    if (!backup.session?.token && !backup.sdkSession?.token) {
        emitLifecycleEvent({
            iframeLifecycle: "remove-backup",
        });
        return;
    }

    // Add hash to backup data
    const hashProtected: HashProtectedBackup = {
        ...backup,
        validationHash: await hashJson(backup),
    };

    // Encode as JSON + base64url
    const encoded = base64urlEncode(
        new TextEncoder().encode(JSON.stringify(hashProtected))
    );

    // And then push the event
    emitLifecycleEvent({
        iframeLifecycle: "do-backup",
        data: { backup: encoded },
    });
}
