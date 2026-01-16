import { base64urlDecode, base64urlEncode } from "@frak-labs/core-sdk";
import { type Hex, sha256 } from "viem";
import { sessionStore } from "../../stores/sessionStore";
import type { SdkSession, Session } from "../../types/Session";
import { emitLifecycleEvent } from "./lifecycleEvents";

/**
 * Represent backed up data
 */
type BackupData = {
    productId: Hex;
    session?: Session;
    sdkSession?: SdkSession;
    expireAtTimestamp: number;
};

/**
 * Backup data with hash validation
 */
type HashProtectedBackup = BackupData & { validationHash: string };

/**
 * Hash JSON data with SHA256
 * @param data - Data to hash
 * @returns SHA256 hash as hex string
 */
function hashJson(data: unknown): string {
    return sha256(new TextEncoder().encode(JSON.stringify(data)));
}

/**
 * Restore received backup data
 * @param backup
 * @param productId
 */
export async function restoreBackupData({
    backup,
    productId,
}: {
    backup: string;
    productId: Hex;
}) {
    let data: BackupData | undefined;
    try {
        // Decode base64url + JSON
        const decoded = JSON.parse(
            new TextDecoder().decode(base64urlDecode(backup))
        ) as HashProtectedBackup;

        // Extract and verify hash
        const { validationHash, ...backupData } = decoded;
        if (hashJson(backupData) !== validationHash) {
            throw new Error("Invalid backup hash");
        }

        data = backupData;
    } catch (e) {
        console.error("[Backup] Failed to restore:", e);
        return;
    }

    // Ensure that the backup data is for the current product
    if (data.productId !== productId) {
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
export async function pushBackupData(args?: { productId?: Hex }) {
    // Get the product ID from args (optional for cleanup scenarios)
    const productId = args?.productId;
    if (!productId) {
        console.log("[Backup] No productId provided - skipping backup");
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
        productId,
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
        validationHash: hashJson(backup),
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
