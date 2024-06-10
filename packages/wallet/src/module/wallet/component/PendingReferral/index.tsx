import { frakChainId } from "@/context/blockchain/provider";
import { getPendingReferralReward } from "@/context/interaction/action/pendingReferral";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAAClients } from "@/module/common/hook/useAAClients";
import { useInvalidateUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import {
    type SmartAccountClient,
    getUserOperationReceipt,
} from "permissionless";
import type { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types";
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";
import styles from "./index.module.css";

export function PendingReferral() {
    // Invalidate the user tokens
    const invalidateUserTokens = useInvalidateUserTokens();
    /**
     * Get our current smart wallet client
     */
    const { data: connectorClient } = useConnectorClient();

    // Get the user wallet address
    const address = useMemo(
        () => connectorClient?.account?.address,
        [connectorClient]
    );

    // Fetch the AA transports
    const { bundlerClient } = useAAClients({
        chainId: frakChainId,
    });

    // Fetch the pending reward
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: ["referral", "pending-reward", address],
        queryFn: async () => {
            if (!address) return null;
            return await getPendingReferralReward({
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
            const nexusWallet =
                connectorClient as SmartAccountClient<ENTRYPOINT_ADDRESS_V06_TYPE>;
            if (
                !(
                    nexusWallet.account &&
                    pendingReward?.perContracts &&
                    bundlerClient
                )
            )
                return;

            // For each pending rewards, launch a tx
            const txs = await nexusWallet.account.encodeCallData(
                pendingReward.perContracts.map((contract) => ({
                    to: contract.address,
                    data: contract.claimTx,
                    value: 0n,
                }))
            );

            // Send the user op
            const userOpHash = await nexusWallet.sendUserOperation({
                userOperation: {
                    callData: txs,
                },
                account: nexusWallet.account,
            });

            // Wait for it
            const userOpReceipt = await getUserOperationReceipt(bundlerClient, {
                hash: userOpHash,
            });
            console.log("UserOp receipt", userOpReceipt);

            // Invalidate the user tokens
            await invalidateUserTokens();

            // Refetch the pending reward
            await refetchPendingReward();

            return userOpReceipt?.receipt?.transactionHash;
        },
    });

    return pendingReward?.pFrkPendingRaw ? (
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
                        You got {pendingReward?.pFrkPendingFormatted} pFRK
                        pending thanks to your referral activities!
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
    ) : null;
}
