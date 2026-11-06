import { normalizeRedeemAmount } from "@frak-labs/app-essentials/monerium";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    formatCurrency,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { useTranslation } from "react-i18next";
import { formatUnits, parseUnits } from "viem";
import { useBiometricConfirm } from "@/module/biometrics";
import { SheetScreen } from "@/module/common/component/SheetScreen";
import { useCowQuote } from "@/module/cowSwap/hooks/useCowQuote";
import { useCowSwap } from "@/module/cowSwap/hooks/useCowSwap";
import { getMinBuyAmount, isCowApiError } from "@/module/cowSwap/utils/cowApi";
import { isCowOrderError } from "@/module/cowSwap/utils/waitForCowOrder";
import { getAmountBucket } from "@/module/monerium/utils/amountBucket";
import { isUserCancelledError } from "@/module/monerium/utils/moneriumErrors";
import { useCspBlocked } from "@/module/ramp/hooks/useCspBlocked";
import { rampFlowStore, selectAmount } from "@/module/ramp/store/rampFlowStore";
import { SOURCE_TOKENS } from "@/module/ramp/utils/balances";

function getSwapErrorReason(error: unknown): string {
    if (isCowApiError(error)) return error.errorType ?? `http_${error.status}`;
    if (isCowOrderError(error)) return error.reason;
    return "unknown";
}

function getSwapErrorKey(error: unknown): DefaultTranslationKey {
    if (isCowApiError(error) && error.errorType === "NoLiquidity") {
        return "ramp.flow.swap.errors.noLiquidity";
    }
    if (isCowOrderError(error)) return "ramp.flow.swap.errors.expired";
    return "ramp.flow.swap.errors.generic";
}

const onCowBlocked = () =>
    trackEvent("ramp_blocked_by_csp", { directive: "connect-src" });

function RecapRow({ label, value }: { label: string; value: string }) {
    return (
        <Spread space="m">
            <Text variant="body" color="secondary">
                {label}
            </Text>
            <Text variant="body" weight="medium">
                {value}
            </Text>
        </Spread>
    );
}

/** Step 2 (EURe only): convert to USDC through CoW, since Ramp only buys USDC on Arbitrum. */
export function RampSwapScreen() {
    const { t, i18n } = useTranslation();
    const amount = rampFlowStore(selectAmount);
    const normalized = normalizeRedeemAmount(amount) ?? "0";
    const sellAmount = parseUnits(normalized, SOURCE_TOKENS.eure.decimals);
    const { confirm } = useBiometricConfirm();
    const blocked = useCspBlocked("connect-src", "api.cow.fi", onCowBlocked);

    const swap = useCowSwap();
    const quote = useCowQuote({
        sellToken: SOURCE_TOKENS.eure.address,
        buyToken: SOURCE_TOKENS.usdc.address,
        sellAmount,
        enabled: !swap.isPending && !swap.isSuccess,
    });

    const formatUsdc = (value: bigint) =>
        formatCurrency(
            Number(formatUnits(value, SOURCE_TOKENS.usdc.decimals)),
            "USD",
            i18n.language
        );

    async function handleSwap() {
        if (!(await confirm())) return;
        const amount_bucket = getAmountBucket(normalized);
        swap.mutate(
            {
                sellToken: SOURCE_TOKENS.eure.address,
                buyToken: SOURCE_TOKENS.usdc.address,
                sellAmount,
            },
            {
                onSuccess: ({ boughtAmount }) => {
                    trackEvent("ramp_swap_completed", { amount_bucket });
                    rampFlowStore.getState().startWidget(boughtAmount);
                },
                onError: (error) => {
                    if (isUserCancelledError(error)) return;
                    trackEvent("ramp_swap_failed", {
                        amount_bucket,
                        reason: getSwapErrorReason(error),
                    });
                    recordError(error, { source: "ramp_offramp" });
                },
            }
        );
    }

    const swapError =
        swap.error && !isUserCancelledError(swap.error)
            ? t(getSwapErrorKey(swap.error))
            : undefined;
    const quoteError = quote.error
        ? t(getSwapErrorKey(quote.error))
        : undefined;

    return (
        <SheetScreen
            onClose={() => {
                // Leaving mid-swap would drop the hand-off to the widget.
                if (!swap.isPending) rampFlowStore.getState().goTo("amount");
            }}
            leftIcon="back"
            title={t("ramp.flow.swap.title")}
            description={
                swap.isPending
                    ? t("ramp.flow.swap.pending")
                    : t("ramp.flow.swap.description")
            }
            errorMessage={
                blocked
                    ? t("ramp.flow.updateRequired")
                    : (swapError ?? quoteError)
            }
            ctaLabel={t("ramp.flow.swap.cta")}
            ctaOnClick={handleSwap}
            ctaLoading={swap.isPending}
            ctaDisabled={!quote.data || blocked}
            busy={swap.isPending}
        >
            <Card variant="elevated" padding="cell">
                <Stack space="s">
                    <RecapRow
                        label={t("ramp.flow.swap.youConvert")}
                        value={`${formatCurrency(
                            Number(normalized),
                            "EUR",
                            i18n.language
                        )} EURe`}
                    />
                    <RecapRow
                        label={t("ramp.flow.swap.youGet")}
                        value={
                            quote.data
                                ? `${formatUsdc(quote.data.buyAmount)} USDC`
                                : t("ramp.flow.swap.quoteLoading")
                        }
                    />
                    {quote.data ? (
                        <RecapRow
                            label={t("ramp.flow.swap.atLeast")}
                            value={`${formatUsdc(getMinBuyAmount(quote.data))} USDC`}
                        />
                    ) : null}
                </Stack>
            </Card>
        </SheetScreen>
    );
}
