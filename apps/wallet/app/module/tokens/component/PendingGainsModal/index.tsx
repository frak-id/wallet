import {
    addresses,
    currentStablecoinsList,
    rewarderHubAbi,
} from "@frak-labs/app-essentials/blockchain";
import { tablet } from "@frak-labs/design-system/breakpoints";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@frak-labs/design-system/components/Drawer";
import { Text } from "@frak-labs/design-system/components/Text";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import {
    balanceKey,
    claimableKey,
    currentViemClient,
    rewardsKey,
    WalletModal,
} from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { encodeFunctionData, erc20Abi, formatUnits } from "viem";
import { multicall, waitForTransactionReceipt } from "viem/actions";
import { useAccount, useSendTransaction } from "wagmi";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

function useMediaQuery(query: string) {
    const mediaQueryList = useMemo(() => {
        if (typeof window !== "undefined") {
            return window.matchMedia(query);
        }

        return null;
    }, [query]);

    const [matches, setMatches] = useState(() =>
        mediaQueryList ? mediaQueryList.matches : false
    );

    useEffect(() => {
        if (!mediaQueryList) return;

        const handleChange = () => setMatches(mediaQueryList.matches);
        mediaQueryList.addEventListener("change", handleChange);

        return () => mediaQueryList.removeEventListener("change", handleChange);
    }, [mediaQueryList]);

    return matches;
}

type PendingGainsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function PendingGainsModal({
    open,
    onOpenChange,
}: PendingGainsModalProps) {
    const { t } = useTranslation();
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    // Fetch claimable amounts via on-chain multicall
    const { data: pendingReward, refetch: refetchPendingReward } = useQuery({
        queryKey: claimableKey.pending.byAddress(address),
        queryFn: async () => {
            if (!address) return [];

            const contracts = currentStablecoinsList.flatMap(
                (token) =>
                    [
                        {
                            address: addresses.rewarderHub,
                            abi: rewarderHubAbi,
                            functionName: "getClaimable",
                            args: [address, token],
                        },
                        {
                            address: token,
                            abi: erc20Abi,
                            functionName: "decimals",
                        },
                    ] as const
            );

            const result = await multicall(currentViemClient, {
                contracts,
                allowFailure: false,
            });

            return currentStablecoinsList
                .map((token, index) => ({
                    token,
                    amount: result[index * 2] as bigint,
                    decimals: result[index * 2 + 1] as number,
                }))
                .filter((item) => item.amount > 0n);
        },
        enabled: !!address && open,
        meta: { storable: false },
    });

    const totalClaimable = useMemo(() => {
        if (!pendingReward?.length) return 0;
        return pendingReward.reduce(
            (sum, item) =>
                sum + Number(formatUnits(item.amount, item.decimals)),
            0
        );
    }, [pendingReward]);

    // Claim mutation
    const {
        mutateAsync: sendClaimTxs,
        isPending,
        isSuccess,
    } = useMutation({
        mutationKey: claimableKey.claim.byAddress(address),
        mutationFn: async () => {
            if (!(pendingReward?.length && address)) return;

            const data = encodeFunctionData({
                abi: rewarderHubAbi,
                functionName: "claimBatch",
                args: [pendingReward.map(({ token }) => token)],
            });

            const txHash = await sendTransactionAsync({
                to: addresses.rewarderHub,
                data,
            });

            queryClient.setQueryData(
                claimableKey.pending.byAddress(address),
                []
            );
            await waitForTransactionReceipt(currentViemClient, {
                hash: txHash,
            });
            await refetchPendingReward();
            await queryClient.invalidateQueries({
                queryKey: balanceKey.baseKey,
                exact: false,
            });
            await queryClient.invalidateQueries({
                queryKey: rewardsKey.all,
                exact: false,
            });
            return txHash;
        },
        onSuccess: () => {
            onOpenChange(false);
        },
    });

    const title = t("wallet.pendingGains.subtitle");
    const description = t("wallet.pendingGains.description");
    const closeLabel = t("common.close");

    const formattedAmount = `+${totalClaimable.toFixed(2).replace(".", ",")}€`;

    const content = (
        <Box className={styles.pendingGains}>
            <Box className={styles.textGroup}>
                <Box className={styles.amountBlock}>
                    <Text as="p" variant="caption" color="secondary">
                        {t("wallet.pendingGains.subtitle")}
                    </Text>
                    <Text as="p" className={styles.amount}>
                        {formattedAmount}
                    </Text>
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
                disabled={isPending || isSuccess || totalClaimable <= 0}
                onClick={async () => {
                    await sendClaimTxs();
                }}
            >
                {t("wallet.pendingGains.confirm")}
            </Button>
        </Box>
    );

    if (isDesktop) {
        return (
            <WalletModal
                text={content}
                open={open}
                onOpenChange={onOpenChange}
                closeButton={
                    <CloseButton
                        ariaLabel={closeLabel}
                        iconSize={24}
                        variant="inline"
                        onClick={() => onOpenChange(false)}
                    />
                }
            />
        );
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            shouldScaleBackground={false}
            modal={true}
        >
            <DrawerContent hideHandle={true}>
                <DrawerHeader className={styles.header}>
                    <CloseButton
                        ariaLabel={closeLabel}
                        iconSize={24}
                        variant="inline"
                        onClick={() => onOpenChange(false)}
                    />
                </DrawerHeader>
                <DrawerTitle className={visuallyHidden}>{title}</DrawerTitle>
                <DrawerDescription className={visuallyHidden}>
                    {description}
                </DrawerDescription>
                {content}
            </DrawerContent>
        </Drawer>
    );
}
