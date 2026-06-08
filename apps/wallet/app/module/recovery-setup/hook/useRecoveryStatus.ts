import type { RecoveryStatusResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

/**
 * Whether the backend holds a stored recovery blob for the current wallet's
 * identity group. Distinct from `useRecoverySetupStatus`, which reads the
 * on-chain recovery module.
 */
export function useRecoveryStatus() {
    const session = useStore(sessionStore, selectSession);

    return useQuery<RecoveryStatusResponse>({
        queryKey: recoverySetupKey.backendStatus,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.auth.recovery.get();
            if (error) throw error;
            return data;
        },
        enabled: !!session?.token,
        staleTime: 60 * 1000,
    });
}
