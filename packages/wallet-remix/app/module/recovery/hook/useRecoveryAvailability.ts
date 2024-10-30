import type { GetRecoveryAvailabilityResponse } from "@/context/recover/action/get.server";
import { useFetcherWithPromise } from "@/module/common/hook/useFetcherWithPromise";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetch the recovery status for the given chain
 */
export function useRecoveryAvailability({
    file,
    newAuthenticatorId,
}: { file: RecoveryFileContent; newAuthenticatorId: string }) {
    const fetcher = useFetcherWithPromise<GetRecoveryAvailabilityResponse>();

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
            const data = await fetcher.submit(
                {
                    wallet: file.initialWallet.address,
                    expectedGuardian: file.guardianAddress,
                    newAuthenticatorId,
                },
                {
                    action: "/recovery",
                    method: "post",
                }
            );
            if (!data) {
                return undefined;
            }
            return data;
        },
    });
    return {
        ...queryStuff,
        recoveryAvailability: data,
    };
}
