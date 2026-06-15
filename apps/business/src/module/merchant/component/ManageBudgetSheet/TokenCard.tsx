import type { Stablecoin } from "@frak-labs/app-essentials";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { PauseIcon } from "@frak-labs/design-system/icons";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { AlertTriangle, ArrowUpCircle, Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Address, formatUnits, parseUnits } from "viem";
import { Tooltip } from "@/module/common/component/Tooltip";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import {
    currencyMetadata,
    formatTokenBalance,
} from "@/module/common/utils/currencyOptions";
import { Input } from "@/module/forms/Input";
import { useBankAllowanceMutation } from "@/module/merchant/hook/useBankAllowanceMutation";
import { useWithdrawFromBank } from "@/module/merchant/hook/useWithdrawFromBank";
import {
    type BudgetToken,
    getTokenStatus,
    statusBadgeVariant,
    type TokenStatus,
} from "@/module/merchant/utils/budgetTokens";
import * as styles from "./manage-budget-sheet.css";

function CurrencyLabel({ token }: { token: BudgetToken }) {
    const meta = currencyMetadata[token.symbol as Stablecoin];
    return (
        <Inline space="xs" alignY="center">
            <Text
                variant="bodySmall"
                weight="medium"
                color="secondary"
                as="span"
            >
                {meta.currencySymbol}
            </Text>
            <Tooltip content={meta.providerDescription}>
                <Text variant="caption" color="disabled" as="span">
                    {meta.provider}
                </Text>
            </Tooltip>
        </Inline>
    );
}

export function FundedTokenCard({
    token,
    merchantId,
    bankAddress,
    isManager,
    isBankOpen,
}: {
    token: BudgetToken;
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isBankOpen: boolean;
}) {
    const { t } = useTranslation();
    const stablecoin = token.symbol as Stablecoin;
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? 18;
    const status = isBankOpen
        ? getTokenStatus(token.balance, token.allowance)
        : "paused";
    const needsAllowanceIncrease =
        token.allowance < token.balance && isBankOpen;

    return (
        <Card radius="m">
            <Stack space="xs">
                <Stack space="xxs">
                    <Inline
                        space="xs"
                        align="space-between"
                        alignY="top"
                        wrap={false}
                    >
                        <CurrencyLabel token={token} />
                        <TokenStatusBadge
                            token={token}
                            status={status}
                            decimals={decimals}
                            isBankOpen={isBankOpen}
                        />
                    </Inline>

                    <Stack space="none">
                        <span className={styles.amount}>
                            {formatTokenBalance(
                                token.balance,
                                stablecoin,
                                decimals
                            )}
                        </span>
                        <Text variant="bodySmall" color="tertiary" as="span">
                            {t("funding.budget.available")}
                        </Text>
                    </Stack>
                </Stack>

                {isManager && (
                    <TokenActions
                        token={token}
                        merchantId={merchantId}
                        bankAddress={bankAddress}
                        isBankOpen={isBankOpen}
                        needsAllowanceIncrease={needsAllowanceIncrease}
                        decimals={decimals}
                    />
                )}
            </Stack>
        </Card>
    );
}

export function EmptyTokenCard({ token }: { token: BudgetToken }) {
    const { t } = useTranslation();
    const stablecoin = token.symbol as Stablecoin;
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? 18;

    return (
        <Card radius="m" className={styles.emptyCard}>
            <Stack space="xxs">
                <CurrencyLabel token={token} />
                <Stack space="none">
                    <span className={styles.amount}>
                        {formatTokenBalance(0n, stablecoin, decimals)}
                    </span>
                    <Text variant="caption" color="tertiary" as="span">
                        {t("funding.budget.noFundsCaption")}
                    </Text>
                </Stack>
            </Stack>
        </Card>
    );
}

function TokenStatusBadge({
    token,
    status,
    decimals,
    isBankOpen,
}: {
    token: BudgetToken;
    status: TokenStatus;
    decimals: number;
    isBankOpen: boolean;
}) {
    const { t } = useTranslation();
    if (status === "empty") return null;

    const stablecoin = token.symbol as Stablecoin;
    const allowanceLabel =
        isBankOpen && token.allowance > 0n
            ? t("funding.budget.allowanceTooltip", {
                  amount: formatTokenBalance(
                      token.allowance,
                      stablecoin,
                      decimals
                  ),
              })
            : undefined;

    const label =
        status === "active"
            ? t("funding.budget.status.active")
            : status === "warning"
              ? t("funding.budget.status.actionNeeded")
              : t("funding.budget.status.paused");

    const badge = (
        <Badge variant={statusBadgeVariant[status]} size="small">
            {label}
        </Badge>
    );

    if (!allowanceLabel) return badge;

    return <Tooltip content={allowanceLabel}>{badge}</Tooltip>;
}

function TokenActions({
    token,
    merchantId,
    bankAddress,
    isBankOpen,
    needsAllowanceIncrease,
    decimals,
}: {
    token: BudgetToken;
    merchantId: string;
    bankAddress: Address;
    isBankOpen: boolean;
    needsAllowanceIncrease: boolean;
    decimals: number;
}) {
    const { t } = useTranslation();
    const [action, setAction] = useState<"allowance" | "withdraw" | null>(null);

    if (action === "allowance") {
        return (
            <AllowanceEditor
                token={token}
                merchantId={merchantId}
                bankAddress={bankAddress}
                decimals={decimals}
                onDone={() => setAction(null)}
            />
        );
    }

    if (action === "withdraw") {
        return (
            <WithdrawEditor
                token={token}
                merchantId={merchantId}
                bankAddress={bankAddress}
                decimals={decimals}
                onDone={() => setAction(null)}
            />
        );
    }

    return (
        <div className={styles.actionsRow}>
            {needsAllowanceIncrease && (
                <span className={styles.warningChip}>
                    <AlertTriangle width={14} height={14} />
                    {t("funding.budget.limitTooLow")}
                </span>
            )}
            {needsAllowanceIncrease && (
                <Button
                    size="small"
                    variant="secondary"
                    width="auto"
                    icon={<ArrowUpCircle size={16} />}
                    onClick={() => setAction("allowance")}
                >
                    {t("funding.budget.actions.increaseLimit")}
                </Button>
            )}
            {isBankOpen && token.allowance > 0n && (
                <PauseRewardsButton
                    token={token}
                    merchantId={merchantId}
                    bankAddress={bankAddress}
                />
            )}
            {!isBankOpen && token.balance > 0n && (
                <Tooltip content={t("funding.budget.actions.withdrawTooltip")}>
                    <Button
                        size="small"
                        variant="secondary"
                        width="auto"
                        icon={<Download size={16} />}
                        onClick={() => setAction("withdraw")}
                    >
                        {t("funding.budget.actions.withdrawCta")}
                    </Button>
                </Tooltip>
            )}
        </div>
    );
}

function PauseRewardsButton({
    token,
    merchantId,
    bankAddress,
}: {
    token: BudgetToken;
    merchantId: string;
    bankAddress: Address;
}) {
    const { t } = useTranslation();
    const { mutate: revokeAllowance, isPending } = useBankAllowanceMutation({
        bankAddress,
        merchantId,
        action: "revoke",
    });

    return (
        <Button
            size="small"
            variant="secondary"
            width="auto"
            loading={isPending}
            disabled={isPending}
            icon={<PauseIcon width={16} height={16} />}
            onClick={() => revokeAllowance({ token: token.address })}
        >
            {t("funding.pause.title")}
        </Button>
    );
}

function AllowanceEditor({
    token,
    merchantId,
    bankAddress,
    decimals,
    onDone,
}: {
    token: BudgetToken;
    merchantId: string;
    bankAddress: Address;
    decimals: number;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const defaultValue = formatUnits(token.balance * 10n, decimals);
    const [value, setValue] = useState(defaultValue);
    const { mutate: updateAllowance, isPending } = useBankAllowanceMutation({
        bankAddress,
        merchantId,
        action: "update",
    });

    return (
        <div className={styles.actionsRow}>
            <Input
                type="number"
                placeholder={t("funding.budget.actions.amountPlaceholder")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={styles.inlineInput}
                autoFocus
            />
            <Button
                size="small"
                variant="primary"
                width="auto"
                disabled={!value || isPending}
                loading={isPending}
                onClick={() =>
                    value &&
                    updateAllowance(
                        {
                            token: token.address,
                            amount: parseUnits(value, decimals),
                        },
                        { onSuccess: onDone }
                    )
                }
            >
                {t("funding.budget.actions.confirm")}
            </Button>
            <Button
                size="small"
                variant="ghost"
                width="auto"
                disabled={isPending}
                onClick={onDone}
            >
                {t("funding.budget.actions.cancel")}
            </Button>
        </div>
    );
}

function WithdrawEditor({
    token,
    merchantId,
    bankAddress,
    decimals,
    onDone,
}: {
    token: BudgetToken;
    merchantId: string;
    bankAddress: Address;
    decimals: number;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const [value, setValue] = useState("");
    const { mutate: withdraw, isPending } = useWithdrawFromBank({
        bankAddress,
        merchantId,
    });
    const { data: walletStatusData } = useWalletStatus();
    const walletAddress = walletStatusData?.wallet;

    return (
        <div className={styles.actionsRow}>
            <Input
                type="number"
                placeholder={t("funding.budget.actions.amountPlaceholder")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={styles.inlineInput}
                autoFocus
            />
            <Button
                size="small"
                variant="primary"
                width="auto"
                disabled={!value || isPending}
                loading={isPending}
                onClick={() =>
                    value &&
                    walletAddress &&
                    withdraw(
                        {
                            token: token.address,
                            amount: parseUnits(value, decimals),
                            to: walletAddress,
                        },
                        { onSuccess: onDone }
                    )
                }
            >
                {t("funding.budget.actions.withdraw")}
            </Button>
            <Button
                size="small"
                variant="ghost"
                width="auto"
                disabled={isPending}
                onClick={onDone}
            >
                {t("funding.budget.actions.cancel")}
            </Button>
        </div>
    );
}
