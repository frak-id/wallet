import { addresses } from "@/context/common/blockchain/addresses";
import { nexusDiscoverCampaignAbi } from "@/context/referral/abi/campaign-abis";
import { getPendingWalletReferralReward } from "@/context/referral/action/pendingReferral";
import { sessionAtom } from "@/module/common/atoms/session";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useInvalidateUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { CircleDollarSign } from "lucide-react";
import { useWriteContract } from "wagmi";
import styles from "./index.module.css";

export function PendingReferral() {
    // Invalidate the user tokens
    const invalidateUserTokens = useInvalidateUserTokens();

    // Fetch the current user session
    const session = useAtomValue(sessionAtom);

    // Get the user wallet address
    const address = session?.wallet?.address;

    // Fetch the pending reward
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: ["getPendingWalletReferralReward"],
        queryFn: async () => {
            if (!address) return null;
            return await getPendingWalletReferralReward({
                user: address,
            });
        },
        enabled: !!address,
    });

    // Get the write contract function
    const { writeContractAsync, isPending, isSuccess } = useWriteContract({
        mutation: {
            onSuccess: async () => {
                // Invalidate the user tokens
                await invalidateUserTokens();

                // Refetch the pending reward
                await refetchPendingReward();
            },
        },
    });

    return pendingReward?.rFrkPendingRaw ? (
        <Panel size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                Pending referral reward
            </Title>
            {isSuccess && (
                <p className={styles.pendingReferral__success}>
                    You have claimed your reward successfully!
                </p>
            )}
            {!isSuccess && (
                <>
                    <p>
                        You got {pendingReward?.rFrkPendingFormatted} rFRK
                        pending thanks to your referral activities!
                    </p>
                    <ButtonRipple
                        className={styles.pendingReferral__button}
                        size={"small"}
                        isLoading={isPending}
                        disabled={isPending || isSuccess}
                        onClick={async () => {
                            // Launch the transaction
                            await writeContractAsync({
                                abi: nexusDiscoverCampaignAbi,
                                address: addresses.nexusDiscoverCampaign,
                                functionName: "pullReward",
                            });
                        }}
                    >
                        Claim
                    </ButtonRipple>
                </>
            )}
        </Panel>
    ) : null;
}
