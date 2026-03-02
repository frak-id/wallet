import type { Stablecoin } from "@frak-labs/app-essentials";
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

type ActiveAction = {
    token: TokenData;
    type: "allowance" | "withdraw";
} | null;

function BankView({
    bankAddress,
    isManager,
}: {
    bankAddress: Address;
    isManager: boolean;
}) {
    const { data: bankData, isLoading } = useMerchantBank({ bankAddress });
    const { data: walletStatus } = useWalletStatus();
    const walletAddress = walletStatus?.wallet;
    const { t } = useTranslation();
    const [activeAction, setActiveAction] = useState<ActiveAction>(null);

    if (isLoading || !bankData) {
        return <SkeletonDisplayText size="small" />;
    }

    const { isOpen, tokens } = bankData;
    const allTokensEmpty = tokens.every((token) => token.balance === 0n);

    return (
        <s-stack gap="base">
            {isManager && walletAddress && (
                <DistributionToggle bankAddress={bankAddress} isOpen={isOpen} />
            )}

            {allTokensEmpty && isOpen && (
                <s-banner tone="warning">
                    <p>{t("status.bank.emptyWarning")}</p>
                </s-banner>
            )}

            <TokenTable
                tokens={tokens}
                isManager={isManager}
                isBankOpen={isOpen}
                walletAddress={walletAddress}
                bankAddress={bankAddress}
                onAction={setActiveAction}
            />

            {activeAction && (
                <TokenActionForm
                    key={`${activeAction.token.address}-${activeAction.type}`}
                    activeAction={activeAction}
                    bankAddress={bankAddress}
                    walletAddress={walletAddress}
                    onClose={() => setActiveAction(null)}
                />
            )}

            {isManager && !walletAddress && (
                <s-banner tone="info">
                    <p>{t("status.bank.connectWallet")}</p>
                </s-banner>
            )}
        </s-stack>
    );
}

function DistributionToggle({
    bankAddress,
    isOpen,
}: {
    bankAddress: Address;
    isOpen: boolean;
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
                disabled={isSettingOpenStatus}
            >
                {isOpen
                    ? t("status.bank.disableDistribution")
                    : t("status.bank.enableDistribution")}
            </s-button>
        </s-stack>
    );
}

function TokenTable({
    tokens,
    isManager,
    isBankOpen,
    walletAddress,
    bankAddress,
    onAction,
}: {
    tokens: TokenData[];
    isManager: boolean;
    isBankOpen: boolean;
    walletAddress?: Address;
    bankAddress: Address;
    onAction: (action: ActiveAction) => void;
}) {
    const { t } = useTranslation();
    const showActions = isManager && !!walletAddress;

    return (
        <s-table>
            <s-table-header-row>
                <s-table-header listSlot="primary">
                    {t("status.bank.token")}
                </s-table-header>
                <s-table-header>{t("status.bank.balance")}</s-table-header>
                <s-table-header>{t("status.bank.statusColumn")}</s-table-header>
                {showActions && (
                    <s-table-header>
                        {t("status.bank.actionsColumn")}
                    </s-table-header>
                )}
            </s-table-header-row>
            <s-table-body>
                {tokens.map((token) => (
                    <TokenRow
                        key={token.address}
                        token={token}
                        isBankOpen={isBankOpen}
                        bankAddress={bankAddress}
                        showActions={showActions}
                        onAction={onAction}
                    />
                ))}
            </s-table-body>
        </s-table>
    );
}

function TokenRow({
    token,
    isBankOpen,
    bankAddress,
    showActions,
    onAction,
}: {
    token: TokenData;
    isBankOpen: boolean;
    bankAddress: Address;
    showActions: boolean;
    onAction: (action: ActiveAction) => void;
}) {
    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];
    const status = getTokenStatus(token.balance, token.allowance);
    const formattedBalance = formatTokenBalance(
        token.balance,
        stablecoin,
        token.decimals
    );

    return (
        <s-table-row>
            <s-table-cell>
                {meta.label} ({meta.provider})
            </s-table-cell>
            <s-table-cell>{formattedBalance}</s-table-cell>
            <s-table-cell>
                <TokenStatusBadge status={status} />
            </s-table-cell>
            {showActions && (
                <s-table-cell>
                    <TokenRowActions
                        token={token}
                        bankAddress={bankAddress}
                        isBankOpen={isBankOpen}
                        onAction={onAction}
                    />
                </s-table-cell>
            )}
        </s-table-row>
    );
}

function TokenStatusBadge({
    status,
}: {
    status: ReturnType<typeof getTokenStatus>;
}) {
    const { t } = useTranslation();

    if (status === "empty") {
        return <s-text color="subdued">{t("status.bank.tokenEmpty")}</s-text>;
    }
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

function TokenRowActions({
    token,
    bankAddress,
    isBankOpen,
    onAction,
}: {
    token: TokenData;
    bankAddress: Address;
    isBankOpen: boolean;
    onAction: (action: ActiveAction) => void;
}) {
    const { t } = useTranslation();
    const { mutate: revokeAllowance, isPending: isRevoking } =
        useRevokeBankAllowance({ bankAddress });
    const hasBalance = token.balance > 0n;
    const needsAllowanceIncrease =
        hasBalance && token.allowance < token.balance && isBankOpen;

    if (!hasBalance) {
        return null;
    }

    return (
        <s-stack direction="inline" gap="small">
            {needsAllowanceIncrease && (
                <s-button
                    onClick={() => onAction({ token, type: "allowance" })}
                >
                    {t("status.bank.increaseLimit")}
                </s-button>
            )}
            {token.allowance > 0n && (
                <s-button
                    variant="secondary"
                    onClick={() => revokeAllowance({ token: token.address })}
                    loading={isRevoking}
                    disabled={isRevoking}
                >
                    {t("status.bank.pauseRewards")}
                </s-button>
            )}
            {!isBankOpen && hasBalance && (
                <s-button
                    variant="secondary"
                    onClick={() => onAction({ token, type: "withdraw" })}
                >
                    {t("status.bank.withdraw")}
                </s-button>
            )}
        </s-stack>
    );
}

function TokenActionForm({
    activeAction,
    bankAddress,
    walletAddress,
    onClose,
}: {
    activeAction: NonNullable<ActiveAction>;
    bankAddress: Address;
    walletAddress?: Address;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const { token, type } = activeAction;
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
        <s-section>
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
        </s-section>
    );
}
