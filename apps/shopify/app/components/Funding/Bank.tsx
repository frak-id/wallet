import { formatAmount } from "@frak-labs/core-sdk";
import { SkeletonDisplayText } from "app/components/ui/SkeletonDisplayText";
import type { loader as rootLoader } from "app/routes/app";
import type { BankStatus } from "app/services.server/backendMerchant";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import { type Address, formatUnits } from "viem";
import { useConversionRate } from "../../hooks/useConversionRate";
import { useTokenInfoWithBalance } from "../../hooks/usetokenInfo";

/**
 * Default reward token per stage (USDC).
 * The backend `/bank` endpoint does not return the token address,
 * so we hardcode the merchant's default reward token (USDC).
 */
const defaultRewardToken: Address =
    process.env.STAGE === "production"
        ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
        : "0x43838DCb58a61325eC5F31FD70aB8cd3540733d1";

export function BankingStatus({ bankStatus }: { bankStatus: BankStatus }) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.bank.title")}</s-heading>

                <s-text>{t("status.bank.description")}</s-text>

                {bankStatus.deployed && bankStatus.bankAddress ? (
                    <BankItem bankAddress={bankStatus.bankAddress} />
                ) : (
                    <s-text>
                        {t("status.bank.notDeployed", "Bank not deployed yet")}
                    </s-text>
                )}
            </s-stack>
        </s-section>
    );
}

/**
 * Display the bank balance using on-chain ERC20 multicall.
 * Uses hardcoded default reward token (USDC) since the backend
 * `/bank` endpoint doesn't return token info.
 */
function BankItem({ bankAddress }: { bankAddress: Address }) {
    const { data: tokenInfo, isLoading: tokenInfoLoading } =
        useTokenInfoWithBalance({
            token: defaultRewardToken,
            wallet: bankAddress,
        });
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const { rate } = useConversionRate({ token: defaultRewardToken });

    const balance = useMemo(() => {
        if (!tokenInfo || !rate) {
            return undefined;
        }

        const currency = rootData?.shop.preferredCurrency ?? "usd";
        const floatValue = Number.parseFloat(
            formatUnits(tokenInfo.balance ?? 0n, tokenInfo.decimals ?? 18)
        );
        const currencyRate = rate[currency] ?? 1;

        return formatAmount(floatValue * currencyRate, currency);
    }, [tokenInfo, rate, rootData?.shop.preferredCurrency]);
    const { t } = useTranslation();

    if (tokenInfoLoading || !tokenInfo) {
        return <SkeletonDisplayText size="small" />;
    }

    return (
        <s-table>
            <s-table-header-row>
                <s-table-header>{t("status.bank.token")}</s-table-header>
                <s-table-header>{t("status.bank.balance")}</s-table-header>
                <s-table-header>{t("status.bank.address")}</s-table-header>
            </s-table-header-row>
            <s-table-body>
                <s-table-row>
                    <s-table-cell>{`${tokenInfo.name} (${tokenInfo.symbol})`}</s-table-cell>
                    <s-table-cell>{balance}</s-table-cell>
                    <s-table-cell>{bankAddress}</s-table-cell>
                </s-table-row>
            </s-table-body>
        </s-table>
    );
    // TODO: totalDistributed / totalClaimed no longer available from backend — add when endpoint supports it
}
