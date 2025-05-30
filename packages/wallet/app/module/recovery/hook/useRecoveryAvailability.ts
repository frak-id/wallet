import { getRecoveryAvailability } from "@/module/recovery/action/get";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the recovery status for the given chain
 */
export function useRecoveryAvailability({
    file,
    newAuthenticatorId,
}: {
    file: RecoveryFileContent;
    newAuthenticatorId: string;
}) {
    const { data, ...queryStuff } = useQuery({
        queryKey: recoveryKey.availableChains.full({
            walletAddress: file.initialWallet.address,
            guardianAddress: file.guardianAddress,
        }),
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
