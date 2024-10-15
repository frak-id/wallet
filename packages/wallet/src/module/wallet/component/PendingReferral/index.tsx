import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { backendApi } from "@frak-labs/shared/context/server";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { encodeFunctionData } from "viem";
import { useAccount, useSendTransaction } from "wagmi";
import styles from "./index.module.css";

export function PendingReferral() {
    const { t } = useTranslation();
    // Get the user wallet address
    const { address } = useAccount();

    const { sendTransactionAsync } = useSendTransaction();

    // Fetch the pending reward
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: ["claimable", "pending", address],
        queryFn: async () => {
            const { data, error } =
                await backendApi.wallet.balance.claimable.get();
            if (error) throw error;

            return data;
        },
        enabled: !!address,
    });

    // Mutation to send the claim txs
    const {
        mutateAsync: sendClaimTxs,
        isPending,
        isSuccess,
    } = useMutation({
        mutationKey: ["claimable", "do-claim", address],
        mutationFn: async () => {
            if (!(pendingReward?.claimables && address)) return;

            // Build each claim tx
            const claimTxs = pendingReward.claimables.map((claimable) => ({
                to: claimable.contract,
                data: encodeFunctionData({
                    abi: campaignBankAbi,
                    functionName: "pullReward",
                    args: [address],
                }),
                value: 0n,
            }));

            // For each pending rewards, launch a tx
            const txs = encodeWalletMulticall(claimTxs);

            // Send the user op
            const txHash = await sendTransactionAsync({
                to: address,
                data: txs,
            });

            // Refetch the pending reward
            await refetchPendingReward();

            return txHash;
        },
    });

    if (!pendingReward?.eurClaimable) {
        return null;
    }

    return (
        <Panel size={"small"}>
            <Title icon={<CircleDollarSign width={32} height={32} />}>
                {t("wallet.pendingReferral.title")}
            </Title>
            {isSuccess && (
                <p className={styles.pendingReferral__success}>
                    {t("wallet.pendingReferral.success")}
                </p>
            )}
            {!isSuccess && (
                <>
                    <p>
                        {t("wallet.pendingReferral.text", {
                            eurClaimable: pendingReward?.eurClaimable,
                        })}
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
                        {t("common.claim")}
                    </ButtonRipple>
                </>
            )}
        </Panel>
    );
}
