import { getPendingRewards } from "@/context/interaction/action/pendingRewards";
import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useAccount, useSendTransaction } from "wagmi";
import styles from "./index.module.css";

export function PendingReferral() {
    // Get the user wallet address
    const { address } = useAccount();

    const { sendTransactionAsync } = useSendTransaction();

    // Fetch the pending reward
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: ["referral", "pending-reward", address],
        queryFn: async () => {
            if (!address) return null;
            return await getPendingRewards({
                user: address,
            });
        },
        enabled: !!address,
    });

    // Mutation to send the claim txs
    const {
        mutateAsync: sendClaimTxs,
        isPending,
        isSuccess,
    } = useMutation({
        mutationKey: ["referral", "claim-reward", address],
        mutationFn: async () => {
            if (!pendingReward?.perContracts) return;

            // For each pending rewards, launch a tx
            const txs = encodeWalletMulticall(
                pendingReward.perContracts.map((contract) => ({
                    to: contract.address,
                    data: contract.claimTx,
                    value: 0n,
                }))
            );

            // Send the user op
            const txHash = await sendTransactionAsync({
                to: address,
                data: txs,
            });
            console.log("UserOp receipt", txHash);

            // Refetch the pending reward
            await refetchPendingReward();

            return txHash;
        },
    });

    if (!pendingReward?.pendingRaw) {
        return null;
    }

    return (
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
                        You got {pendingReward?.pendingFormatted} mUSD pending
                        thanks to your referral activities!
                    </p>
                    <ButtonRipple
                        className={styles.pendingReferral__button}
                        size={"small"}
                        isLoading={isPending}
                        disabled={isPending || isSuccess}
                        onClick={async () => {
                            await sendClaimTxs();
                        }}
                    >
                        Claim
                    </ButtonRipple>
                </>
            )}
        </Panel>
    );
}
