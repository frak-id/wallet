import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { sessionAtom } from "@/module/common/atoms/session";
import {
    addPendingInteractionsAtom,
    pendingInteractionAtom,
} from "@/module/wallet/atoms/pendingInteraction";
import type { PendingInteraction } from "@/types/Interaction";
import type { Session } from "@/types/Session";
import {
    type CompressedData,
    decompressDataAndCheckHash,
    hashAndCompressData,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { tryit } from "radash";
import type { Hex } from "viem";

/**
 * Represent backed up data
 */
type BackupData = {
    productId: Hex;
    session?: Session;
    pendingInteractions?: PendingInteraction[];
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
    const compressedBackup = JSON.parse(backup) as CompressedData;

    // Decompress the backup data and
    const [, data] = await tryit(() =>
        decompressDataAndCheckHash<BackupData>(compressedBackup)
    )();
    if (!data) {
        throw new Error("Invalid backup data");
    }

    // Ensure that the backup data is for the current product
    if (data.productId !== productId) {
        throw new Error("Invalid backup data");
    }

    // todo: additional security measure

    // Put everything in the right jotai stores
    if (data.session) {
        jotaiStore.set(sessionAtom, data.session);
    }
    if (data.pendingInteractions) {
        jotaiStore.set(addPendingInteractionsAtom, data.pendingInteractions);
    }
}

/**
 * Push new backup data
 * @param productId
 */
export async function pushBackupData({
    productId,
}: {
    productId: Hex;
}) {
    // Build backup datas
    const backup: BackupData = {
        productId,
        session: jotaiStore.get(sessionAtom) ?? undefined,
        pendingInteractions: jotaiStore.get(pendingInteractionAtom)
            .interactions,
    };

    // Create a compressed backup
    const compressedBackup = await hashAndCompressData(backup);

    // And then push the event
    emitLifecycleEvent({
        iframeLifecycle: "do-backup",
        data: { backup: JSON.stringify(compressedBackup) },
    });
}

/**
 * Remove existing backup data
 */
export function removeBackupData() {
    emitLifecycleEvent({
        iframeLifecycle: "remove-backup",
    });
}
