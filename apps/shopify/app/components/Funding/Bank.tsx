import type { Stablecoin } from "@frak-labs/app-essentials";
import {
    type BankBalanceBreakdown,
    BILLING_RATES,
    bpsToPercent,
    grossUpBankBalance,
} from "@frak-labs/app-essentials/constants/billing";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { SkeletonDisplayText } from "app/components/ui/SkeletonDisplayText";
import type { BankStatus } from "app/services.server/backendMerchant";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Address, formatUnits, parseUnits } from "viem";
import {
    useRevokeBankAllowance,
    useSetBankOpenStatus,
    useUpdateBankAllowance,
    useWithdrawFromBank,
} from "../../hooks/useBankActions";
import { type TokenData, useMerchantBank } from "../../hooks/useMerchantBank";
import {
    currencyMetadata,
    formatTokenBalance,
    getTokenStatus,
} from "../../utils/tokenStatus";
import { LoginWithFrak } from "../LoginWithFrak";

export function BankingStatus({ bankStatus }: { bankStatus: BankStatus }) {
    const { t } = useTranslation();

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("status.bank.title")}</s-heading>
                <s-text>{t("status.bank.description")}</s-text>

                {bankStatus.deployed && bankStatus.bankAddress ? (
                    <BankView
                        bankAddress={bankStatus.bankAddress}
                        isManager={bankStatus.ownerHasManagerRole}
                        vatApplicable={bankStatus.vatApplicable}
                    />
                ) : (
                    <s-banner tone="info">
                        <p>{t("status.bank.notDeployed")}</p>
                    </s-banner>
                )}
            </s-stack>
        </s-section>
    );
}

type TokenAction = "allowance" | "withdraw";

function BankView({
    bankAddress,
    isManager,
    vatApplicable,
}: {
    bankAddress: Address;
    isManager: boolean;
    vatApplicable: boolean;
}) {
    const { data: bankData, isLoading } = useMerchantBank({ bankAddress });
    const { data: walletStatus } = useWalletStatus();
    const walletAddress = walletStatus?.wallet;
    const isLoggedIn = !!walletAddress;
    const { t } = useTranslation();

    if (isLoading || !bankData) {
        return <SkeletonDisplayText size="small" />;
    }

    const { isOpen, tokens } = bankData;
    const funded = tokens.filter((token) => token.balance > 0n);
    const empty = tokens.filter((token) => token.balance === 0n);

    return (
        <s-stack gap="base">
            {isManager && (
                <DistributionToggle
                    bankAddress={bankAddress}
                    isOpen={isOpen}
                    disabled={!isLoggedIn}
                />
            )}

            {isManager && !isLoggedIn && (
                <s-banner tone="info">
                    <s-stack gap="small">
                        <s-text>{t("status.bank.connectWallet")}</s-text>
                        <LoginWithFrak />
                    </s-stack>
                </s-banner>
            )}

            {funded.length === 0 && isOpen && (
                <s-banner tone="warning">
                    <s-text>{t("status.bank.emptyWarning")}</s-text>
                </s-banner>
            )}

            {funded.map((token) => (
                <FundedTokenCard
                    key={token.address}
                    token={token}
                    isBankOpen={isOpen}
                    vatApplicable={vatApplicable}
                    bankAddress={bankAddress}
                    walletAddress={walletAddress}
                    showActions={isManager}
                />
            ))}

            {empty.length > 0 && (
                <s-grid
                    gridTemplateColumns="repeat(auto-fit, minmax(10rem, 1fr))"
                    gap="base"
                >
                    {empty.map((token) => (
                        <EmptyTokenCard key={token.address} token={token} />
                    ))}
                </s-grid>
            )}
        </s-stack>
    );
}

function DistributionToggle({
    bankAddress,
    isOpen,
    disabled = false,
}: {
    bankAddress: Address;
    isOpen: boolean;
    disabled?: boolean;
}) {
    const { setOpenStatus, isSettingOpenStatus } = useSetBankOpenStatus({
        bankAddress,
    });
    const { t } = useTranslation();

    return (
        <s-stack direction="inline" gap="small" alignItems="center">
            <s-text>{t("status.bank.distribution")}</s-text>
            {isOpen ? (
                <s-badge tone="success">
                    {t("status.bank.distributionActive")}
                </s-badge>
            ) : (
                <s-badge tone="warning">
                    {t("status.bank.distributionPaused")}
                </s-badge>
            )}
            <s-button
                variant={isOpen ? "secondary" : "primary"}
                onClick={() => setOpenStatus({ isOpen: !isOpen })}
                loading={isSettingOpenStatus}
                disabled={isSettingOpenStatus || disabled}
            >
                {isOpen
                    ? t("status.bank.disableDistribution")
                    : t("status.bank.enableDistribution")}
            </s-button>
        </s-stack>
    );
}

function CurrencyLabel({ token }: { token: TokenData }) {
    const meta = currencyMetadata[token.symbol as Stablecoin];
    const tooltipId = `bank-provider-${token.symbol}`;

    return (
        <s-stack direction="inline" gap="small-300" alignItems="baseline">
            <s-text type="strong">{meta.currencySymbol}</s-text>
            <s-text color="subdued" interestFor={tooltipId}>
                {meta.provider}
            </s-text>
            <s-tooltip id={tooltipId}>{meta.providerDescription}</s-tooltip>
        </s-stack>
    );
}

function FundedTokenCard({
    token,
    isBankOpen,
    vatApplicable,
    bankAddress,
    walletAddress,
    showActions,
}: {
    token: TokenData;
    isBankOpen: boolean;
    vatApplicable: boolean;
    bankAddress: Address;
    walletAddress?: Address;
    showActions: boolean;
}) {
    const { t } = useTranslation();
    const [action, setAction] = useState<TokenAction | null>(null);
    const stablecoin = token.symbol as Stablecoin;
    const breakdown = grossUpBankBalance(token.balance, vatApplicable);

    return (
        <s-box border="base" borderRadius="base" padding="base">
            <s-stack gap="base">
                <s-stack
                    direction="inline"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <CurrencyLabel token={token} />
                    <TokenStatusBadge
                        status={getTokenStatus(token.balance, token.allowance)}
                    />
                </s-stack>

                <s-stack gap="small-500">
                    <s-heading>
                        {formatTokenBalance(
                            breakdown.gross,
                            stablecoin,
                            token.decimals
                        )}
                    </s-heading>
                    <s-text color="subdued">
                        {vatApplicable
                            ? t("status.bank.totalInclVat")
                            : t("status.bank.totalExclVat")}
                    </s-text>
                </s-stack>

                <s-divider />
                <BalanceBreakdown
                    token={token}
                    breakdown={breakdown}
                    vatApplicable={vatApplicable}
                />

                {showActions && <s-divider />}
                {showActions &&
                    (action ? (
                        <TokenActionForm
                            token={token}
                            type={action}
                            bankAddress={bankAddress}
                            walletAddress={walletAddress}
                            onClose={() => setAction(null)}
                        />
                    ) : (
                        <TokenActions
                            token={token}
                            bankAddress={bankAddress}
                            isBankOpen={isBankOpen}
                            disabled={!walletAddress}
                            onAction={setAction}
                        />
                    ))}
            </s-stack>
        </s-box>
    );
}

function EmptyTokenCard({ token }: { token: TokenData }) {
    const { t } = useTranslation();

    return (
        <s-box
            border="base"
            borderRadius="base"
            padding="base"
            background="subdued"
        >
            <s-stack gap="small-300">
                <CurrencyLabel token={token} />
                <s-text type="strong">
                    {formatTokenBalance(
                        0n,
                        token.symbol as Stablecoin,
                        token.decimals
                    )}
                </s-text>
                <s-text color="subdued">{t("status.bank.tokenEmpty")}</s-text>
            </s-stack>
        </s-box>
    );
}

function BalanceBreakdown({
    token,
    breakdown,
    vatApplicable,
}: {
    token: TokenData;
    breakdown: BankBalanceBreakdown;
    vatApplicable: boolean;
}) {
    const { t } = useTranslation();
    const format = (amount: bigint) =>
        formatTokenBalance(amount, token.symbol as Stablecoin, token.decimals);

    return (
        <s-stack gap="small-300">
            <BreakdownRow
                label={t("status.bank.breakdown.distributable")}
                value={format(breakdown.distributable)}
                emphasis
            />
            <BreakdownRow
                label={t("status.bank.breakdown.frakFee", {
                    rate: bpsToPercent(BILLING_RATES.FRAK_FEE_BPS),
                })}
                value={format(breakdown.frakFee)}
            />
            {vatApplicable && (
                <BreakdownRow
                    label={t("status.bank.breakdown.vat", {
                        rate: bpsToPercent(BILLING_RATES.FR_VAT_BPS),
                    })}
                    value={format(breakdown.vat)}
                />
            )}
        </s-stack>
    );
}

function BreakdownRow({
    label,
    value,
    emphasis = false,
}: {
    label: string;
    value: string;
    emphasis?: boolean;
}) {
    const type = emphasis ? "strong" : undefined;
    const color = emphasis ? undefined : "subdued";

    return (
        <s-stack direction="inline" justifyContent="space-between" gap="base">
            <s-text type={type} color={color}>
                {label}
            </s-text>
            <s-text type={type} color={color} fontVariantNumeric="tabular-nums">
                {value}
            </s-text>
        </s-stack>
    );
}

function TokenStatusBadge({
    status,
}: {
    status: ReturnType<typeof getTokenStatus>;
}) {
    const { t } = useTranslation();

    if (status === "active") {
        return <s-badge tone="success">{t("status.bank.tokenActive")}</s-badge>;
    }
    if (status === "warning") {
        return (
            <s-badge tone="warning">{t("status.bank.tokenWarning")}</s-badge>
        );
    }
    return <s-badge tone="critical">{t("status.bank.tokenPaused")}</s-badge>;
}

function TokenActions({
    token,
    bankAddress,
    isBankOpen,
    disabled,
    onAction,
}: {
    token: TokenData;
    bankAddress: Address;
    isBankOpen: boolean;
    disabled: boolean;
    onAction: (action: TokenAction) => void;
}) {
    const { t } = useTranslation();
    const { mutate: revokeAllowance, isPending: isRevoking } =
        useRevokeBankAllowance({ bankAddress });
    const needsAllowanceIncrease =
        token.allowance < token.balance && isBankOpen;

    return (
        <s-stack direction="inline" gap="small">
            {needsAllowanceIncrease && (
                <s-button
                    onClick={() => onAction("allowance")}
                    disabled={disabled}
                >
                    {t("status.bank.increaseLimit")}
                </s-button>
            )}
            {token.allowance > 0n && (
                <s-button
                    variant="secondary"
                    onClick={() => revokeAllowance({ token: token.address })}
                    loading={isRevoking}
                    disabled={isRevoking || disabled}
                >
                    {t("status.bank.pauseRewards")}
                </s-button>
            )}
            {!isBankOpen && (
                <s-button
                    variant="secondary"
                    onClick={() => onAction("withdraw")}
                    disabled={disabled}
                >
                    {t("status.bank.withdraw")}
                </s-button>
            )}
        </s-stack>
    );
}

function TokenActionForm({
    token,
    type,
    bankAddress,
    walletAddress,
    onClose,
}: {
    token: TokenData;
    type: TokenAction;
    bankAddress: Address;
    walletAddress?: Address;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];

    const defaultValue =
        type === "allowance"
            ? formatUnits(token.balance * 10n, token.decimals)
            : "";
    const [inputValue, setInputValue] = useState(defaultValue);

    const { mutate: updateAllowance, isPending: isUpdating } =
        useUpdateBankAllowance({ bankAddress });
    const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawFromBank({
        bankAddress,
    });
    const isPending = isUpdating || isWithdrawing;

    const handleConfirm = () => {
        if (!inputValue) return;

        if (type === "allowance") {
            updateAllowance(
                {
                    token: token.address,
                    amount: parseUnits(inputValue, token.decimals),
                },
                { onSuccess: onClose }
            );
        } else if (walletAddress) {
            withdraw(
                {
                    token: token.address,
                    amount: parseUnits(inputValue, token.decimals),
                    to: walletAddress,
                },
                { onSuccess: onClose }
            );
        }
    };

    return (
        <s-stack gap="small">
            <s-text>
                {type === "allowance"
                    ? t("status.bank.setAllowanceFor", {
                          token: meta.label,
                      })
                    : t("status.bank.withdrawFrom", {
                          token: meta.label,
                      })}
            </s-text>
            <s-stack direction="inline" gap="small" alignItems="end">
                <s-number-field
                    label={
                        type === "allowance"
                            ? t("status.bank.allowanceAmount")
                            : t("status.bank.withdrawAmount")
                    }
                    value={inputValue}
                    onChange={(e: Event) =>
                        setInputValue(
                            (e.currentTarget as HTMLInputElement).value
                        )
                    }
                    autocomplete="off"
                    min={0}
                    step={0.01}
                    suffix={meta.currencySymbol}
                    details={
                        type === "withdraw"
                            ? t("status.bank.withdrawMax", {
                                  amount: formatTokenBalance(
                                      token.balance,
                                      stablecoin,
                                      token.decimals
                                  ),
                              })
                            : undefined
                    }
                    disabled={isPending}
                />
                <s-button
                    variant="primary"
                    onClick={handleConfirm}
                    loading={isPending}
                    disabled={!inputValue || isPending}
                >
                    {t("status.bank.confirm")}
                </s-button>
                <s-button
                    variant="secondary"
                    onClick={onClose}
                    disabled={isPending}
                >
                    {t("status.bank.cancel")}
                </s-button>
            </s-stack>
        </s-stack>
    );
}
