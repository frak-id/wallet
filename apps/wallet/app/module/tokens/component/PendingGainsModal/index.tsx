import { addresses } from "@frak-labs/app-essentials/blockchain";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    authenticatedWalletApi,
    claimableKey,
    formatCurrency,
    rewardsKey,
    sessionStore,
    userBalanceQueryOptions,
} from "@frak-labs/wallet-shared";
import { type QueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { type Address, encodeFunctionData, isAddressEqual } from "viem";
import { useConnection, useSendTransaction } from "wagmi";
import { CloseButton } from "@/module/common/component/CloseButton";
import { useGetPendingRewards } from "@/module/tokens/hook/useGetPendingRewards";
import { useGetUnpaidRewards } from "@/module/tokens/hook/useGetUnpaidRewards";
import { rewarderClaimBatchAbi } from "@/module/tokens/utils/abi";
import {
    addClaims,
    includesClaims,
} from "@/module/tokens/utils/claimedBalance";
import * as styles from "./index.css";

const SETTLE_POLL_MS = 3_000;
const SETTLE_MAX_POLLS = 15;

type PendingGainsModalProps = {
    onClose: () => void;
};

export function PendingGainsModal({ onClose }: PendingGainsModalProps) {
    const { t, i18n } = useTranslation();
    const { address } = useConnection();
    const { mutateAsync: sendTransactionAsync } = useSendTransaction();
    const { totalClaimable, pendingRewards } = useGetPendingRewards();
    const { totalUnpaid } = useGetUnpaidRewards();

    // Claim mutation
    const { mutateAsync: sendClaimTxs, isPending } = useMutation({
        mutationKey: claimableKey.claim.byAddress(address),
        mutationFn: async (_data, { client }) => {
            if (!(pendingRewards?.length && address)) return;

            const data = encodeFunctionData({
                abi: [rewarderClaimBatchAbi],
                functionName: "claimBatch",
                args: [pendingRewards.map(({ token }) => token)],
            });

            // Resolves once the claim is mined.
            const txHash = await sendTransactionAsync({
                to: addresses.rewarderHub,
                data,
            });

            // Chain reads (ours and the backend's) lag up to ~30 s behind the
            // chain head, so a refetch now would bring the claimed amount back.
            const balanceQueryKey = userBalanceQueryOptions(address).queryKey;
            await client.cancelQueries({ queryKey: claimableKey.baseKey });
            await client.cancelQueries({ queryKey: balanceQueryKey });
            client.setQueryData(claimableKey.pending.byAddress(address), []);
            const before = client.getQueryData(balanceQueryKey);
            if (before) {
                client.setQueryData(
                    balanceQueryKey,
                    addClaims(before, pendingRewards)
                );
            }
            void settleBalance(client, address, before, pendingRewards).catch(
                () => client.invalidateQueries({ queryKey: balanceQueryKey })
            );

            await client.invalidateQueries({
                queryKey: rewardsKey.all,
                exact: false,
            });
            return txHash;
        },
        onSuccess: () => {
            onClose();
        },
    });

    const formattedAmount = `+${formatCurrency(totalClaimable, "EUR", i18n.language)}`;

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={t("wallet.pendingGains.subtitle")}
            description={t("wallet.pendingGains.description")}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={onClose}
                />
            }
        >
            <Box className={styles.pendingGains}>
                <Box className={styles.textGroup}>
                    <Box className={styles.amountBlock}>
                        <Text as="p" variant="caption" color="secondary">
                            {t("wallet.pendingGains.subtitle")}
                        </Text>
                        <Text as="p" className={styles.amount}>
                            {formattedAmount}
                        </Text>
                        {totalUnpaid > 0 && (
                            <Text as="p" variant="bodySmall" color="secondary">
                                {t("wallet.pendingGains.unpaid", {
                                    amount: formatCurrency(
                                        totalUnpaid,
                                        "EUR",
                                        i18n.language
                                    ),
                                })}
                            </Text>
                        )}
                    </Box>
                    <Text as="h2" className={styles.heading}>
                        {t("wallet.pendingGains.heading")}
                    </Text>
                    <Text as="p" color="secondary">
                        {t("wallet.pendingGains.description")}
                    </Text>
                </Box>
                <Button
                    className={styles.confirmButton}
                    disabled={isPending || totalClaimable <= 0}
                    onClick={async () => {
                        await sendClaimTxs();
                    }}
                >
                    {t("wallet.pendingGains.confirm")}
                </Button>
            </Box>
        </ResponsiveModal>
    );
}

/** Swaps the optimistic balance for the backend's once it reflects the claim. */
async function settleBalance(
    client: QueryClient,
    address: Address,
    before: Parameters<typeof includesClaims>[1],
    claims: Parameters<typeof includesClaims>[2]
) {
    const { queryKey } = userBalanceQueryOptions(address);
    // `/balance` answers for whoever is signed in now, so a logout or an
    // account switch must stop the loop before it caches another wallet here.
    const isStillClaimer = () => {
        const current = sessionStore.getState().session?.address;
        return current !== undefined && isAddressEqual(current, address);
    };
    for (let poll = 0; poll < SETTLE_MAX_POLLS; poll++) {
        await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
        if (!isStillClaimer()) return;
        const { data } = await authenticatedWalletApi.balance.get();
        if (!isStillClaimer()) return;
        if (data && includesClaims(data, before, claims)) {
            client.setQueryData(queryKey, data);
            return;
        }
    }
    if (isStillClaimer()) await client.invalidateQueries({ queryKey });
}
