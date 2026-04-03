import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { installCodeKey } from "@/module/recovery-code/queryKeys/install-code";
import {
    installCodeStore,
    selectPendingCode,
} from "@/module/recovery-code/stores/installCodeStore";

/**
 * Hook to consume a pending install code after registration.
 *
 * Call `consumePendingCode()` once the user is authenticated.
 * It reads the code from the persisted store, calls `/consume`,
 * and clears the store on success.
 */
export function useConsumeInstallCode() {
    const pendingCode = installCodeStore(selectPendingCode);

    const {
        mutate: consumePendingCode,
        mutateAsync: consumePendingCodeAsync,
        ...mutationState
    } = useMutation({
        mutationKey: installCodeKey.consume,
        mutationFn: async () => {
            const code = installCodeStore.getState().pendingCode;
            if (!code) return;

            const { error } = await authenticatedBackendApi.user.identity[
                "install-code"
            ].consume.post({ code: code.code });

            if (error) {
                throw new Error("Failed to consume install code");
            }

            installCodeStore.getState().reset();
        },
    });

    return {
        pendingCode,
        consumePendingCode,
        consumePendingCodeAsync,
        ...mutationState,
    };
}
