import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useCallback, useRef } from "react";
import { installCodeStore } from "../stores/installCodeStore";

/**
 * Hook to consume a pending install code after registration.
 *
 * Call `consumePendingCode()` once the user is authenticated.
 * It reads the code from the persisted store, calls `/consume`,
 * and clears the store on success. Idempotent — won't fire twice.
 */
export function useConsumeInstallCode() {
    const pendingCode = installCodeStore((s) => s.pendingCode);
    const clearPendingCode = installCodeStore((s) => s.clearPendingCode);
    const consumingRef = useRef(false);

    const consumePendingCode = useCallback(async () => {
        if (!pendingCode || consumingRef.current) return;
        consumingRef.current = true;

        const { error } = await authenticatedBackendApi.user.identity[
            "install-code"
        ].consume.post({ code: pendingCode.code });

        if (error) {
            consumingRef.current = false;
            return;
        }

        clearPendingCode();
    }, [pendingCode, clearPendingCode]);

    return { pendingCode, consumePendingCode };
}
