import type { Stablecoin } from "@frak-labs/app-essentials";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button, buttonVariants } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { IconInfo } from "@frak-labs/ui/component/IconInfo";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Switch } from "@frak-labs/ui/component/Switch";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
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
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import {
    formatTokenBalance,
    stablecoinMetadata,
} from "@/module/common/utils/stablecoinMetadata";
import { FormLayout } from "@/module/forms/Form";
import { useFundTestBank } from "@/module/merchant/hook/useFundTestBank";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import { useRevokeBankAllowance } from "@/module/merchant/hook/useRevokeBankAllowance";
import { useSetBankOpenStatus } from "@/module/merchant/hook/useSetBankOpenStatus";
import { useSyncMerchantBank } from "@/module/merchant/hook/useSyncMerchantBank";
import { useUpdateBankAllowance } from "@/module/merchant/hook/useUpdateBankAllowance";
import { useWithdrawFromBank } from "@/module/merchant/hook/useWithdrawFromBank";
import styles from "./index.module.css";

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
                    <div className={styles.bankContent}>
                        <Title as="h3" size="small" icon={<Wallet />}>
                            Reward Budget
                        </Title>
                        <p>
                            Set up your reward budget to start distributing
                            rewards to your users.
                        </p>
                        <Button
                            variant="submit"
                            onClick={() => syncBank()}
                            isLoading={isSyncing}
                            disabled={isSyncing}
                        >
                            Set Up Budget
                        </Button>
                    </div>
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
    return (
        <Panel className={styles.bankPanel}>
            <div className={styles.bankContent}>
                <div className={styles.bankHeaderRow}>
                    <div className={styles.bankTitleGroup}>
                        <Title as="h3" size="small" icon={<Wallet />}>
                            Reward Budget
                        </Title>
                    </div>

                    {isManager && (
                        <DistributionToggle
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isOpen={isOpen ?? false}
                        />
                    )}
                </div>

                <TokenGridSections
                    tokens={tokens}
                    merchantId={merchantId}
                    bankAddress={bankAddress}
                    isManager={isManager}
                    isBankOpen={isOpen ?? false}
                />

                <div className={styles.fundActionsRow}>
                    <a
                        href={process.env.FUNDING_ON_RAMP_URL ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "submit" })}
                    >
                        Add funds via Stripe
                    </a>
                    <TestFundButton bankAddress={bankAddress} />
                </div>
            </div>
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
        <div className={styles.tokenSections}>
            <div className={styles.tokenGrid}>{renderCards(fundedTokens)}</div>
            {emptyTokens.length > 0 && (
                <div className={styles.tokenGrid}>
                    {renderCards(emptyTokens)}
                </div>
            )}
        </div>
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
    const meta = stablecoinMetadata[stablecoin];
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? meta.decimals;
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
        status === "empty" && styles["tokenCard--empty"],
        status === "active" && styles["tokenCard--active"],
        status === "warning" && styles["tokenCard--warning"],
        status === "paused" && styles["tokenCard--paused"],
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={cardClassName}>
            <div className={styles.tokenCard__header}>
                <div className={styles.tokenCard__currencyGroup}>
                    <span className={styles.tokenCard__currency}>
                        {meta.currencySymbol}
                    </span>
                    <Tooltip content={meta.providerDescription}>
                        <Badge size="small" variant="information">
                            {meta.provider}
                        </Badge>
                    </Tooltip>
                </div>
                <TokenStatusBadge
                    token={token}
                    status={status}
                    decimals={decimals}
                />
            </div>

            <div>
                <div className={styles.tokenCard__balance}>
                    {formattedBalance}
                </div>
                {hasBalance ? (
                    <span className={styles.tokenCard__availableLabel}>
                        available
                    </span>
                ) : (
                    <span className={styles.tokenCard__emptyLabel}>
                        No funds
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
        useUpdateBankAllowance({ bankAddress, merchantId });
    const { mutate: revokeAllowance, isPending: isRevokingAllowance } =
        useRevokeBankAllowance({ bankAddress, merchantId });
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
            <div className={styles.tokenCard__actions}>
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
                        variant="submit"
                        onClick={handleUpdateAllowance}
                        disabled={!inputValue || isPending}
                        isLoading={isUpdatingAllowance}
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
            <div className={styles.tokenCard__actions}>
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
                        variant="submit"
                        onClick={handleWithdraw}
                        disabled={!inputValue || isPending}
                        isLoading={isWithdrawing}
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
        <div className={styles.tokenCard__actions}>
            {needsAllowanceIncrease && (
                <div className={styles.tokenCard__warning}>
                    <AlertTriangle width={14} height={14} />
                    <span>Distribution limit too low</span>
                </div>
            )}
            <div className={styles.tokenCard__actionButtons}>
                {needsAllowanceIncrease && (
                    <Button
                        size="small"
                        variant="outline"
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
                        isLoading={isRevokingAllowance}
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
            </div>
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
            isLoading={isPending}
        >
            <Wallet width={16} height={16} />
            Fund with Test Tokens
        </Button>
    );
}
