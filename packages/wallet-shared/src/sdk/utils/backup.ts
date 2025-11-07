import { base64urlDecode, base64urlEncode } from "@frak-labs/core-sdk";
import {
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/frame-connector";
import type { Hex } from "viem";
import { sessionStore } from "../../stores/sessionStore";
import { walletStore } from "../../stores/walletStore";
import type { PendingInteraction } from "../../types/Interaction";
import type { SdkSession, Session } from "../../types/Session";
import { emitLifecycleEvent } from "./lifecycleEvents";

/**
 * Represent backed up data
 */
type BackupData = {
    productId: Hex;
    session?: Session;
    pendingInteractions?: PendingInteraction[];
    sdkSession?: SdkSession;
    expireAtTimestamp: number;
};

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
    // Decompress the backup data and
    let data: BackupData | undefined;
    try {
        const decompressed = base64urlDecode(backup);
        data = decompressDataAndCheckHash<BackupData>(decompressed);
    } catch (e) {
        console.error("Error decompressing backup data", {
            e,
            backup,
        });
    }
    if (!data) {
        console.log("restoreBackupData - invalid backup data", { data });
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
    if (data.pendingInteractions) {
        walletStore.getState().addPendingInteractions(data.pendingInteractions);
    }
}

/**
 * Push new backup data
 */
export async function pushBackupData(args?: { productId?: Hex }) {
    // Get the product ID from args (optional for cleanup scenarios)
    const productId = args?.productId;
    if (!productId) {
        console.log("No productId provided - skipping backup");
        return;
    }
    // Get the current backup data from stores
    const sessionState = sessionStore.getState();
    const walletState = walletStore.getState();

    const session = sessionState.session;
    const sdkSession = sessionState.sdkSession;
    const pendingInteractions = walletState.pendingInteractions.interactions;

    // Build backup datas
    const backup: BackupData = {
        session: session?.token ? session : undefined,
        sdkSession: sdkSession?.token ? sdkSession : undefined,
        pendingInteractions,
        productId,
        // Backup will expire in a week
        expireAtTimestamp: Date.now() + 7 * 24 * 60 * 60_000,
    };
    console.log("Pushing new backup data to parent client", { backup });

    // If nothing to back up, just remove it
    if (
        !backup.session?.token &&
        !backup.sdkSession?.token &&
        !backup.pendingInteractions?.length
    ) {
        emitLifecycleEvent({
            iframeLifecycle: "remove-backup",
        });
        return;
    }

    // Create a compressed backup
    const compressedBackup = hashAndCompressData(backup);

    // And then push the event
    emitLifecycleEvent({
        iframeLifecycle: "do-backup",
        data: { backup: base64urlEncode(compressedBackup) },
    });
}
