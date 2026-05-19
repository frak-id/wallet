import type { Stablecoin } from "@frak-labs/app-essentials";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { useWalletStatus } from "@frak-labs/react-sdk";
import {
    AlertTriangle,
    ArrowUpCircle,
    Download,
    PauseCircle,
    Wallet,
} from "lucide-react";
import { useState } from "react";
import { type Address, formatUnits, parseUnits } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Button } from "@/module/common/component/Button";
import { IconInfo } from "@/module/common/component/IconInfo";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { Tooltip } from "@/module/common/component/Tooltip";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import {
    currencyMetadata,
    formatTokenBalance,
} from "@/module/common/utils/currencyOptions";
import { FormLayout } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { useBankAllowanceMutation } from "@/module/merchant/hook/useBankAllowanceMutation";
import { useFundTestBank } from "@/module/merchant/hook/useFundTestBank";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import { useSetBankOpenStatus } from "@/module/merchant/hook/useSetBankOpenStatus";
import { useSyncMerchantBank } from "@/module/merchant/hook/useSyncMerchantBank";
import { useWithdrawFromBank } from "@/module/merchant/hook/useWithdrawFromBank";
import * as styles from "./funding.css";
import { LegacyBankMigration } from "./LegacyBankMigration";

export function MerchantFunding({ merchantId }: { merchantId: string }) {
    const { data, isLoading, isError } = useGetMerchantBank({ merchantId });
    const { mutate: syncBank, isPending: isSyncing } = useSyncMerchantBank({
        merchantId,
    });

    if (isLoading) {
        return (
            <FormLayout>
                <Spinner />
            </FormLayout>
        );
    }

    if (isError || !data) {
        return (
            <FormLayout>
                <Panel>
                    <p className={styles.errorText}>
                        Failed to load reward budget data.
                    </p>
                </Panel>
            </FormLayout>
        );
    }

    if (!data.deployed || !data.bankAddress) {
        return (
            <FormLayout>
                <Panel className={styles.bankPanel}>
                    <Stack space="l">
                        <Title as="h3" size="small" icon={<Wallet />}>
                            Reward Budget
                        </Title>
                        <p>
                            Set up your reward budget to start distributing
                            rewards to your users.
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => syncBank()}
                            loading={isSyncing}
                            disabled={isSyncing}
                        >
                            Set Up Budget
                        </Button>
                    </Stack>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <RewardBudgetView
                merchantId={merchantId}
                bankAddress={data.bankAddress}
                isManager={data.isManager}
                isOpen={data.isOpen}
                tokens={data.tokens}
            />
        </FormLayout>
    );
}

type TokenData = {
    symbol: string;
    address: Address;
    balance: bigint;
    allowance: bigint;
};

function RewardBudgetView({
    merchantId,
    bankAddress,
    isManager,
    isOpen,
    tokens,
}: {
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isOpen: boolean | null;
    tokens: TokenData[];
}) {
    const allTokensEmpty = tokens.every((t) => t.balance === 0n);

    return (
        <Panel className={styles.bankPanel}>
            <Stack space="l">
                <div className={styles.bankHeaderRow}>
                    <Inline space="s" alignY="center">
                        <Title as="h3" size="small" icon={<Wallet />}>
                            Reward Budget
                        </Title>
                    </Inline>

                    {isManager && (
                        <DistributionToggle
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isOpen={isOpen ?? false}
                        />
                    )}
                </div>

                <LegacyBankMigration
                    merchantId={merchantId}
                    newBankAddress={bankAddress}
                />

                {allTokensEmpty && isOpen && (
                    <div className={styles.bankWarning}>
                        <AlertTriangle width={16} height={16} />
                        <span>
                            Your bank has no funds. Active campaigns cannot
                            distribute rewards until you add funds.
                        </span>
                    </div>
                )}

                <TokenGridSections
                    tokens={tokens}
                    merchantId={merchantId}
                    bankAddress={bankAddress}
                    isManager={isManager}
                    isBankOpen={isOpen ?? false}
                />

                <div className={styles.fundActionsRow}>
                    <Button
                        as="a"
                        href={process.env.FUNDING_ON_RAMP_URL ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="primary"
                    >
                        Add funds via Stripe
                    </Button>
                    {!isRunningInProd && (
                        <TestFundButton bankAddress={bankAddress} />
                    )}
                </div>
            </Stack>
        </Panel>
    );
}

function DistributionToggle({
    merchantId,
    bankAddress,
    isOpen,
}: {
    merchantId: string;
    bankAddress: Address;
    isOpen: boolean;
}) {
    const { setOpenStatus, isSettingOpenStatus } = useSetBankOpenStatus({
        bankAddress,
        merchantId,
    });

    return (
        <div className={styles.statusToggle}>
            <span className={styles.statusLabel}>Distributing rewards</span>
            <Switch
                checked={isOpen}
                disabled={isSettingOpenStatus}
                onCheckedChange={(checked) =>
                    setOpenStatus({ isOpen: checked })
                }
            />
            {isSettingOpenStatus && <Spinner />}
            <Tooltip content="When enabled, rewards are automatically distributed to your users through active campaigns. Disabling stops all new distributions.">
                <IconInfo />
            </Tooltip>
        </div>
    );
}

function TokenGridSections({
    tokens,
    merchantId,
    bankAddress,
    isManager,
    isBankOpen,
}: {
    tokens: TokenData[];
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isBankOpen: boolean;
}) {
    const fundedTokens = tokens.filter((t) => t.balance > 0n);
    const emptyTokens = tokens.filter((t) => t.balance === 0n);

    const renderCards = (list: TokenData[]) =>
        list.map((token) => (
            <TokenCard
                key={token.address}
                token={token}
                merchantId={merchantId}
                bankAddress={bankAddress}
                isManager={isManager}
                isBankOpen={isBankOpen}
            />
        ));

    if (fundedTokens.length === 0) {
        return (
            <div className={styles.tokenGrid}>{renderCards(emptyTokens)}</div>
        );
    }

    return (
        <Stack space="m">
            <div className={styles.tokenGrid}>{renderCards(fundedTokens)}</div>
            {emptyTokens.length > 0 && (
                <div className={styles.tokenGrid}>
                    {renderCards(emptyTokens)}
                </div>
            )}
        </Stack>
    );
}

function getTokenStatus(balance: bigint, allowance: bigint) {
    if (balance === 0n) return "empty" as const;
    if (allowance === 0n) return "paused" as const;
    if (allowance < balance) return "warning" as const;
    return "active" as const;
}

function TokenCard({
    token,
    merchantId,
    bankAddress,
    isManager,
    isBankOpen,
}: {
    token: TokenData;
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isBankOpen: boolean;
}) {
    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? 18;
    const status = getTokenStatus(token.balance, token.allowance);
    const formattedBalance = formatTokenBalance(
        token.balance,
        stablecoin,
        decimals
    );
    const hasBalance = token.balance > 0n;
    const needsAllowanceIncrease =
        hasBalance && token.allowance < token.balance && isBankOpen;

    const cardClassName = [
        styles.tokenCard,
        status === "empty" && styles.tokenCardEmpty,
        status === "active" && styles.tokenCardActive,
        status === "warning" && styles.tokenCardWarning,
        status === "paused" && styles.tokenCardPaused,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={cardClassName}>
            <Inline space="xs" alignY="center" align="space-between">
                <Inline space="xs" alignY="center">
                    <span className={styles.tokenCardCurrency}>
                        {meta.currencySymbol}
                    </span>
                    <Tooltip content={meta.providerDescription}>
                        <Badge size="small" variant="secondary">
                            {meta.provider}
                        </Badge>
                    </Tooltip>
                </Inline>
                <TokenStatusBadge
                    token={token}
                    status={status}
                    decimals={decimals}
                />
            </Inline>

            <div>
                <div className={styles.tokenCardBalance}>
                    {formattedBalance}
                </div>
                {hasBalance ? (
                    <span className={styles.tokenCardAvailableLabel}>
                        available
                    </span>
                ) : (
                    <span className={styles.tokenCardEmptyLabel}>
                        No funds — add funds to start distributing rewards
                    </span>
                )}
            </div>

            {isManager && hasBalance && (
                <TokenActions
                    token={token}
                    merchantId={merchantId}
                    bankAddress={bankAddress}
                    isBankOpen={isBankOpen}
                    needsAllowanceIncrease={needsAllowanceIncrease}
                    decimals={decimals}
                />
            )}
        </div>
    );
}

function TokenStatusBadge({
    token,
    status,
    decimals,
}: {
    token: TokenData;
    status: ReturnType<typeof getTokenStatus>;
    decimals: number;
}) {
    if (status === "empty") return null;

    const stablecoin = token.symbol as Stablecoin;
    const allowanceLabel =
        token.allowance > 0n
            ? `Up to ${formatTokenBalance(token.allowance, stablecoin, decimals)} authorized for distribution`
            : undefined;

    if (status === "active") {
        return (
            <Tooltip content={allowanceLabel} hidden={!allowanceLabel}>
                <Badge variant="success" size="small">
                    Active
                </Badge>
            </Tooltip>
        );
    }

    if (status === "warning") {
        return (
            <Tooltip content={allowanceLabel} hidden={!allowanceLabel}>
                <Badge variant="warning" size="small">
                    Action needed
                </Badge>
            </Tooltip>
        );
    }

    return (
        <Badge variant="danger" size="small">
            Paused
        </Badge>
    );
}

function TokenActions({
    token,
    merchantId,
    bankAddress,
    isBankOpen,
    needsAllowanceIncrease,
    decimals,
}: {
    token: TokenData;
    merchantId: string;
    bankAddress: Address;
    isBankOpen: boolean;
    needsAllowanceIncrease: boolean;
    decimals: number;
}) {
    const [action, setAction] = useState<"allowance" | "withdraw" | null>(null);
    const defaultAllowanceValue = formatUnits(token.balance * 10n, decimals);
    const [inputValue, setInputValue] = useState(defaultAllowanceValue);

    const { mutate: updateAllowance, isPending: isUpdatingAllowance } =
        useBankAllowanceMutation({
            bankAddress,
            merchantId,
            action: "update",
        });
    const { mutate: revokeAllowance, isPending: isRevokingAllowance } =
        useBankAllowanceMutation({
            bankAddress,
            merchantId,
            action: "revoke",
        });
    const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawFromBank({
        bankAddress,
        merchantId,
    });

    const { data: walletStatusData } = useWalletStatus();
    const walletAddress = walletStatusData?.wallet;

    const isPending =
        isUpdatingAllowance || isRevokingAllowance || isWithdrawing;

    const handleUpdateAllowance = () => {
        if (!inputValue) return;
        updateAllowance(
            {
                token: token.address,
                amount: parseUnits(inputValue, decimals),
            },
            {
                onSuccess: () => {
                    setAction(null);
                    setInputValue(defaultAllowanceValue);
                },
            }
        );
    };

    const handleWithdraw = () => {
        if (!inputValue || !walletAddress) return;
        withdraw(
            {
                token: token.address,
                amount: parseUnits(inputValue, decimals),
                to: walletAddress,
            },
            {
                onSuccess: () => {
                    setAction(null);
                    setInputValue("");
                },
            }
        );
    };

    if (action === "allowance") {
        return (
            <div className={styles.tokenCardActions}>
                <Row align="center" className={styles.actionRow}>
                    <Input
                        type="number"
                        placeholder="Amount"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className={styles.smallInput}
                        autoFocus
                    />
                    <Button
                        size="small"
                        variant="primary"
                        onClick={handleUpdateAllowance}
                        disabled={!inputValue || isPending}
                        loading={isUpdatingAllowance}
                    >
                        Confirm
                    </Button>
                    <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                            setAction(null);
                            setInputValue(defaultAllowanceValue);
                        }}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                </Row>
            </div>
        );
    }

    if (action === "withdraw") {
        return (
            <div className={styles.tokenCardActions}>
                <Row align="center" className={styles.actionRow}>
                    <Input
                        type="number"
                        placeholder="Amount"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className={styles.smallInput}
                        autoFocus
                    />
                    <Button
                        size="small"
                        variant="primary"
                        onClick={handleWithdraw}
                        disabled={!inputValue || isPending}
                        loading={isWithdrawing}
                    >
                        Withdraw
                    </Button>
                    <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                            setAction(null);
                            setInputValue("");
                        }}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                </Row>
            </div>
        );
    }

    return (
        <div className={styles.tokenCardActions}>
            {needsAllowanceIncrease && (
                <div className={styles.tokenCardWarningBox}>
                    <AlertTriangle width={14} height={14} />
                    <span>Distribution limit too low</span>
                </div>
            )}
            <Inline space="xs" alignY="center">
                {needsAllowanceIncrease && (
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={() => setAction("allowance")}
                    >
                        <ArrowUpCircle width={14} height={14} />
                        Increase limit
                    </Button>
                )}
                {token.allowance > 0n && (
                    <Button
                        size="small"
                        variant="ghost"
                        onClick={() =>
                            revokeAllowance({ token: token.address })
                        }
                        disabled={isPending}
                        loading={isRevokingAllowance}
                    >
                        <PauseCircle width={14} height={14} />
                        Pause rewards
                    </Button>
                )}
                {!isBankOpen && token.balance > 0n && (
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={() => setAction("withdraw")}
                    >
                        <Download width={14} height={14} />
                        Withdraw
                    </Button>
                )}
            </Inline>
        </div>
    );
}

function TestFundButton({ bankAddress }: { bankAddress: Address }) {
    const { mutate: fundTestBank, isPending } = useFundTestBank();

    return (
        <Button
            variant="secondary"
            onClick={() => fundTestBank({ bank: bankAddress })}
            disabled={isPending}
            loading={isPending}
        >
            <Wallet width={16} height={16} />
            Fund with Test Tokens
        </Button>
    );
}
