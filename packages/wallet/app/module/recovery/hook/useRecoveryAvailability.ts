import { getRecoveryAvailability } from "@/module/recovery/action/get";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the recovery status for the given chain
 */
export function useRecoveryAvailability({
    file,
    newAuthenticatorId,
}: { file: RecoveryFileContent; newAuthenticatorId: string }) {
    const { data, ...queryStuff } = useQuery({
        queryKey: [
            "recovery",
            "get-available-chains",
            file.initialWallet.address,
            file.guardianAddress,
        ],
        gcTime: 0,
        enabled: !!file.initialWallet.address,
        queryFn: async () => {
            return await getRecoveryAvailability({
                wallet: file.initialWallet.address,
                expectedGuardian: file.guardianAddress,
                newAuthenticatorId,
            });
        },
    });
    return {
        ...queryStuff,
        recoveryAvailability: data,
    };
}
