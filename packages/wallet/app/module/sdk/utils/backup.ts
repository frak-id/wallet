import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { emitLifecycleEvent } from "@/module/sdk/utils/lifecycleEvents";
import {
    addPendingInteractionsAtom,
    pendingInteractionAtom,
} from "@/module/wallet/atoms/pendingInteraction";
import type { PendingInteraction } from "@/types/Interaction";
import type { SdkSession, Session } from "@/types/Session";
import { compressJson, decompressJson } from "@frak-labs/core-sdk";
import { jotaiStore } from "@shared/module/atoms/store";
import { atom } from "jotai";
import type { Hex } from "viem";

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
}: { backup: string; productId: Hex }) {
    // Decompress the backup data and
    const data = decompressJson<BackupData>(backup);

    if (!data) {
        throw new Error("Invalid backup data");
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

    // Put everything in the right atoms
    jotaiStore.set(restoreBackupAtom, data);
}

// Atom to restore backup data all at once
const restoreBackupAtom = atom(null, (_get, set, data: BackupData) => {
    if (data.session?.token) {
        set(sessionAtom, data.session);
    }
    if (data.sdkSession) {
        set(sdkSessionAtom, data.sdkSession);
    }
    if (data.pendingInteractions) {
        set(addPendingInteractionsAtom, data.pendingInteractions);
    }
});

/**
 * Push new backup data
 */
export async function pushBackupData(args?: { productId?: Hex }) {
    // Check if we got an iframe resolving context
    const productId =
        args?.productId ??
        jotaiStore.get(iframeResolvingContextAtom)?.productId;
    if (!productId) {
        console.log("No context to push backup data to");
        return;
    }
    // Get the current atom backup data
    const partialBackup = jotaiStore.get(backupDataAtom);
    // Build backup datas
    const backup: BackupData = {
        ...partialBackup,
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
    const compressedBackup = compressJson(backup);

    // And then push the event
    emitLifecycleEvent({
        iframeLifecycle: "do-backup",
        data: { backup: compressedBackup },
    });
}

// Read the current data all at once to perform a backup
const backupDataAtom = atom((get) => {
    const session = get(sessionAtom);
    const sdkSession = get(sdkSessionAtom);
    const pendingInteractions = get(pendingInteractionAtom).interactions;
    return {
        session: session?.token ? session : undefined,
        sdkSession: sdkSession?.token ? sdkSession : undefined,
        pendingInteractions,
    };
});
