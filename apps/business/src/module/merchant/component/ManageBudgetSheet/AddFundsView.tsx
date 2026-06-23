import { isRunningInProd, type Stablecoin } from "@frak-labs/app-essentials";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { PlusIcon, WalletIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import {
    currencyMetadata,
    formatTokenBalance,
} from "@/module/common/utils/currencyOptions";
import { useFundTestBank } from "@/module/merchant/hook/useFundTestBank";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import type { BudgetToken } from "@/module/merchant/utils/budgetTokens";
import * as styles from "./manage-budget-sheet.css";

export function AddFundsView({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data, isLoading } = useGetMerchantBank({ merchantId });

    if (isLoading) {
        return (
            <div className={styles.centered}>
                <Spinner />
            </div>
        );
    }

    if (!data?.bankAddress) {
        return <p className={styles.errorText}>{t("funding.error")}</p>;
    }

    return (
        <Stack space="l">
            <Stack space="xs">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    as="span"
                >
                    {t("funding.addFunds.balanceLabel")}
                </Text>
                <Card radius="m" padding="none">
                    {data.tokens.map((token) => (
                        <BalanceRow key={token.address} token={token} />
                    ))}
                </Card>
            </Stack>

            <Inline space="m" wrap={false}>
                {!isRunningInProd && (
                    <TestFundButton bankAddress={data.bankAddress} />
                )}
                <Button
                    as="a"
                    href={process.env.FUNDING_ON_RAMP_URL ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="large"
                    width="auto"
                    icon={<PlusIcon width={24} height={24} />}
                    className={styles.flexButton}
                >
                    {t("funding.addFunds.stripe")}
                </Button>
            </Inline>
        </Stack>
    );
}

function BalanceRow({ token }: { token: BudgetToken }) {
    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? 18;

    return (
        <div className={styles.balanceRow}>
            <Text
                variant="bodySmall"
                weight="medium"
                color="secondary"
                as="span"
            >
                {meta.currencySymbol}
            </Text>
            <Text variant="bodySmall" weight="medium" as="span">
                {formatTokenBalance(token.balance, stablecoin, decimals)}
            </Text>
        </div>
    );
}

function TestFundButton({ bankAddress }: { bankAddress: Address }) {
    const { t } = useTranslation();
    const { mutate: fundTestBank, isPending } = useFundTestBank();

    return (
        <Button
            variant="secondary"
            size="large"
            width="auto"
            icon={<WalletIcon width={24} height={24} />}
            className={styles.flexButton}
            disabled={isPending}
            loading={isPending}
            onClick={() => fundTestBank({ bank: bankAddress })}
        >
            {t("funding.addFunds.testTokens")}
        </Button>
    );
}
