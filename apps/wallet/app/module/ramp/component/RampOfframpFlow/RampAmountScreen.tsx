import { normalizeRedeemAmount } from "@frak-labs/app-essentials/monerium";
import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    formatCurrency,
    type RampOfframpSource,
    trackEvent,
    useGetUserBalance,
} from "@frak-labs/wallet-shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { parseUnits } from "viem";
import { SheetScreen } from "@/module/common/component/SheetScreen";
import { focusWithoutScroll } from "@/module/common/utils/focusWithoutScroll";
import {
    rampFlowStore,
    selectAmount,
    selectSource,
} from "@/module/ramp/store/rampFlowStore";
import {
    getSourceBalance,
    getSourceToken,
    SOURCE_TOKENS,
} from "@/module/ramp/utils/balances";
import {
    isEureSwapAvailable,
    RAMP_MIN_AMOUNT,
} from "@/module/ramp/utils/rampConfig";
import * as styles from "./index.css";

const SOURCES: RampOfframpSource[] = isEureSwapAvailable
    ? ["eure", "usdc"]
    : ["usdc"];

const SOURCE_LABEL: Record<RampOfframpSource, string> = {
    eure: "EURe",
    usdc: "USDC",
};

const CURRENCY_SYMBOL: Record<RampOfframpSource, string> = {
    eure: "€",
    usdc: "$",
};

function isRampSource(value: string): value is RampOfframpSource {
    return value === "eure" || value === "usdc";
}

/** Step 1: pick the token to cash out and how much of it. */
export function RampAmountScreen({ onClose }: { onClose: () => void }) {
    const { t, i18n } = useTranslation();
    const { userBalance, isLoading } = useGetUserBalance();
    const source = rampFlowStore(selectSource);
    const amount = rampFlowStore(selectAmount);
    const setSource = rampFlowStore((s) => s.setSource);
    const setAmount = rampFlowStore((s) => s.setAmount);

    const balance = getSourceBalance(userBalance?.balances, source);
    const otherSource = SOURCES.find((s) => s !== source);
    const otherBalance = otherSource
        ? getSourceBalance(userBalance?.balances, otherSource)
        : 0;

    // Land on a token the user actually holds.
    useEffect(() => {
        if (isLoading || !otherSource) return;
        if (balance === 0 && otherBalance > 0) setSource(otherSource);
    }, [isLoading, balance, otherBalance, otherSource, setSource]);

    const normalized = normalizeRedeemAmount(amount);
    const numericAmount = normalized ? Number.parseFloat(normalized) : 0;
    const isInsufficient = numericAmount > balance;
    const isBelowMin = numericAmount > 0 && numericAmount < RAMP_MIN_AMOUNT;
    const canContinue = normalized !== null && !isInsufficient && !isBelowMin;
    const currency = getSourceToken(source).currency;

    function handleAmountInput(event: React.ChangeEvent<HTMLInputElement>) {
        const raw = event.target.value;
        if (raw === "" || /^\d+([.,]\d{0,2})?$/.test(raw)) setAmount(raw);
    }

    function handleContinue() {
        if (!normalized) return;
        trackEvent("ramp_offramp_started", { source });
        const state = rampFlowStore.getState();
        if (source === "eure") {
            state.goTo("swap");
            return;
        }
        state.startWidget(parseUnits(normalized, SOURCE_TOKENS.usdc.decimals));
    }

    const hint = isInsufficient
        ? t("ramp.flow.amount.insufficientBalance")
        : isBelowMin
          ? t("ramp.flow.amount.minimum", {
                amount: formatCurrency(
                    RAMP_MIN_AMOUNT,
                    currency,
                    i18n.language
                ),
            })
          : null;

    return (
        <SheetScreen
            onClose={onClose}
            title={t("ramp.flow.amount.title")}
            description={
                source === "eure"
                    ? t("ramp.flow.amount.descriptionEure")
                    : t("ramp.flow.amount.descriptionUsdc")
            }
            ctaLabel={t("ramp.flow.amount.continue")}
            ctaOnClick={handleContinue}
            ctaDisabled={!canContinue}
        >
            {SOURCES.length > 1 ? (
                <Tabs
                    value={source}
                    onValueChange={(value) => {
                        if (isRampSource(value)) setSource(value);
                    }}
                >
                    <TabsList fullWidth>
                        {SOURCES.map((s) => (
                            <TabsTrigger key={s} value={s} fullWidth>
                                {SOURCE_LABEL[s]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            ) : null}

            <Stack space="xs" align="center" className={styles.amountSection}>
                <Inline space="xs" alignY="center" wrap={false}>
                    <Box
                        as="input"
                        ref={focusWithoutScroll}
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={amount}
                        onChange={handleAmountInput}
                        className={styles.amountInput}
                        style={{
                            width: `${Math.max((amount || "0").length, 1)}ch`,
                        }}
                        aria-label={t("ramp.flow.amount.title")}
                    />
                    <Text variant="display" weight="bold" color="primary">
                        {CURRENCY_SYMBOL[source]}
                    </Text>
                </Inline>
                <Inline space="xs" alignY="center">
                    <Text
                        variant="bodySmall"
                        color={isInsufficient ? "error" : "secondary"}
                    >
                        {t("ramp.flow.amount.balance", {
                            amount: formatCurrency(
                                balance,
                                currency,
                                i18n.language
                            ),
                            token: SOURCE_LABEL[source],
                        })}
                    </Text>
                    {balance > 0 ? (
                        <Box
                            as="button"
                            type="button"
                            className={styles.linkButton}
                            onClick={() => setAmount(balance.toFixed(2))}
                        >
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="action"
                            >
                                {t("ramp.flow.amount.max")}
                            </Text>
                        </Box>
                    ) : null}
                </Inline>
                {hint ? (
                    <Text variant="caption" color="error">
                        {hint}
                    </Text>
                ) : null}
            </Stack>
        </SheetScreen>
    );
}
