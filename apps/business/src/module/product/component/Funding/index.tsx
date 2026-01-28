import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button, buttonVariants } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { IconInfo } from "@frak-labs/ui/component/IconInfo";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { Switch } from "@frak-labs/ui/component/Switch";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import {
    AlertTriangle,
    BadgeCheck,
    CheckCircle,
    Download,
    RefreshCw,
    Wallet,
    XCircle,
} from "lucide-react";
import { useState } from "react";
import { type Address, formatUnits, parseUnits } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { FormLayout } from "@/module/forms/Form";
import { useFundTestBank } from "@/module/product/hook/useFundTestBank";
import { useGetMerchantBank } from "@/module/product/hook/useGetMerchantBank";
import { useRevokeBankAllowance } from "@/module/product/hook/useRevokeBankAllowance";
import { useSetBankOpenStatus } from "@/module/product/hook/useSetBankOpenStatus";
import { useSyncMerchantBank } from "@/module/product/hook/useSyncMerchantBank";
import { useUpdateBankAllowance } from "@/module/product/hook/useUpdateBankAllowance";
import { useWithdrawFromBank } from "@/module/product/hook/useWithdrawFromBank";
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
                        Failed to load merchant bank data.
                    </p>
                </Panel>
            </FormLayout>
        );
    }

    if (!data.deployed || !data.bankAddress) {
        return (
            <FormLayout>
                <Panel title="Setup Merchant Bank" className={styles.bankPanel}>
                    <div className={styles.bankContent}>
                        <p>
                            You need to deploy a campaign bank to start funding
                            your campaigns.
                        </p>
                        <Button
                            variant="submit"
                            onClick={() => syncBank()}
                            isLoading={isSyncing}
                            disabled={isSyncing}
                        >
                            Setup Bank
                        </Button>
                    </div>
                </Panel>
            </FormLayout>
        );
    }

    return (
        <FormLayout>
            <MerchantBankView
                merchantId={merchantId}
                bankAddress={data.bankAddress}
                isManager={data.isManager}
                isOpen={data.isOpen}
                tokens={data.tokens}
            />
        </FormLayout>
    );
}

function MerchantBankView({
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
    tokens: NonNullable<
        ReturnType<typeof useGetMerchantBank>["data"]
    >["tokens"];
}) {
    return (
        <Panel className={styles.bankPanel}>
            <div className={styles.bankContent}>
                <div className={styles.bankHeaderRow}>
                    <div className={styles.bankTitleGroup}>
                        <Title
                            as="h3"
                            size="small"
                            icon={<BadgeCheck color="#0DDB84" />}
                        >
                            Campaign Bank
                        </Title>
                        <Badge variant={isOpen ? "success" : "danger"}>
                            {isOpen ? (
                                <>
                                    <CheckCircle width={14} height={14} /> Open
                                </>
                            ) : (
                                <>
                                    <XCircle width={14} height={14} /> Closed
                                </>
                            )}
                        </Badge>
                    </div>

                    {isManager && (
                        <BankStatusToggle
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isOpen={isOpen ?? false}
                        />
                    )}
                </div>

                <div className={styles.tokenList}>
                    {tokens.map((token) => (
                        <TokenRow
                            key={token.address}
                            token={token}
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isManager={isManager}
                            isBankOpen={isOpen ?? false}
                        />
                    ))}
                </div>

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

function BankStatusToggle({
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
            <span className={styles.statusLabel}>Bank Status</span>
            <Switch
                checked={isOpen}
                disabled={isSettingOpenStatus}
                onCheckedChange={(checked) =>
                    setOpenStatus({ isOpen: checked })
                }
            />
            {isSettingOpenStatus && <Spinner />}
            <Tooltip content="When open, the bank distributes rewards via campaigns">
                <IconInfo />
            </Tooltip>
        </div>
    );
}

function TokenRow({
    token,
    merchantId,
    bankAddress,
    isManager,
    isBankOpen,
}: {
    token: {
        symbol: string;
        address: Address;
        balance: bigint;
        allowance: bigint;
    };
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isBankOpen: boolean;
}) {
    const [action, setAction] = useState<"allowance" | "withdraw" | null>(null);
    const [inputValue, setInputValue] = useState("");

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

    const formattedBalance = formatUnits(token.balance, 6);
    const formattedAllowance = formatUnits(token.allowance, 6);
    const showWarning = token.balance > 0n && token.allowance === 0n;

    const handleUpdateAllowance = () => {
        if (!inputValue) return;
        updateAllowance(
            {
                token: token.address,
                amount: parseUnits(inputValue, 6),
            },
            {
                onSuccess: () => {
                    setAction(null);
                    setInputValue("");
                },
            }
        );
    };

    const handleWithdraw = () => {
        if (!inputValue || !walletAddress) return;
        withdraw(
            {
                token: token.address,
                amount: parseUnits(inputValue, 6),
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

    const isPending =
        isUpdatingAllowance || isRevokingAllowance || isWithdrawing;

    return (
        <div className={styles.tokenRow}>
            <div className={styles.tokenRow__info}>
                <div className={styles.tokenRow__symbol}>
                    {token.symbol.toUpperCase()}
                </div>
                <div className={styles.tokenRow__stats}>
                    <div className={styles.tokenRow__stat}>
                        <span className={styles.statLabel}>Balance:</span>
                        <span className={styles.statValue}>
                            {formattedBalance}
                        </span>
                    </div>
                    <div className={styles.tokenRow__stat}>
                        <span className={styles.statLabel}>Allowance:</span>
                        <span className={styles.statValue}>
                            {formattedAllowance}
                        </span>
                    </div>
                </div>
            </div>

            {showWarning && (
                <div className={styles.tokenRow__warning}>
                    <AlertTriangle width={14} height={14} />
                    <span>Set allowance to enable distribution</span>
                </div>
            )}

            {isManager && (
                <div className={styles.tokenRow__actions}>
                    {action === null && (
                        <>
                            <Button
                                size="small"
                                variant="outline"
                                onClick={() => setAction("allowance")}
                                disabled={!isBankOpen}
                            >
                                <RefreshCw
                                    width={14}
                                    height={14}
                                    className="mr-2"
                                />
                                Update Allowance
                            </Button>

                            {token.allowance > 0n && (
                                <Button
                                    size="small"
                                    variant="ghost"
                                    onClick={() =>
                                        revokeAllowance({
                                            token: token.address,
                                        })
                                    }
                                    disabled={isPending}
                                    isLoading={isRevokingAllowance}
                                >
                                    Revoke
                                </Button>
                            )}

                            {isBankOpen ? (
                                <Tooltip content="Close the bank first to withdraw funds">
                                    <div style={{ display: "inline-block" }}>
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            disabled
                                        >
                                            <Download
                                                width={14}
                                                height={14}
                                                className="mr-2"
                                            />
                                            Withdraw
                                        </Button>
                                    </div>
                                </Tooltip>
                            ) : (
                                <Button
                                    size="small"
                                    variant="secondary"
                                    onClick={() => setAction("withdraw")}
                                >
                                    <Download
                                        width={14}
                                        height={14}
                                        className="mr-2"
                                    />
                                    Withdraw
                                </Button>
                            )}
                        </>
                    )}

                    {action === "allowance" && (
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
                                Update
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
                    )}

                    {action === "withdraw" && (
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
                    )}
                </div>
            )}
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
            <Wallet width={16} height={16} className="mr-2" />
            Fund with Test Tokens
        </Button>
    );
}
