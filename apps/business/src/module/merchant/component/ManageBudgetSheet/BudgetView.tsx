import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { PlusIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { CallOut } from "@/module/common/component/CallOut";
import { useCapabilities } from "@/module/common/hook/useCapabilities";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import { useSetBankOpenStatus } from "@/module/merchant/hook/useSetBankOpenStatus";
import { useSyncMerchantBank } from "@/module/merchant/hook/useSyncMerchantBank";
import {
    type BudgetToken,
    splitTokensByFunding,
} from "@/module/merchant/utils/budgetTokens";
import { ActionFeedback } from "./ActionFeedback";
import { LegacyBankMigration } from "./LegacyBankMigration";
import { LinkWalletNotice } from "./LinkWalletNotice";
import { LoadError } from "./LoadError";
import * as styles from "./manage-budget-sheet.css";
import { EmptyTokenCard, FundedTokenCard } from "./TokenCard";

export function BudgetView({
    merchantId,
    onAddFunds,
}: {
    merchantId: string;
    onAddFunds: () => void;
}) {
    const { data, isLoading, isError, refetch } = useGetMerchantBank({
        merchantId,
    });
    // `managerRole === "no_wallet"` (server-derived) is the source of truth
    // for manager status; `canOnchain` is a redundant client-only check that
    // shows the same CTA immediately after a session change, before a bank
    // refetch would otherwise catch up.
    const { canOnchain } = useCapabilities();

    if (isLoading) {
        return (
            <div className={styles.centered}>
                <Spinner />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <LoadError
                onRetry={() => {
                    refetch();
                }}
            />
        );
    }

    if (!data.deployed || !data.bankAddress) {
        return <SetupBudget merchantId={merchantId} />;
    }

    const isWalletless = data.managerRole === "no_wallet" || !canOnchain;

    return (
        <Stack space="l">
            <BudgetContent
                merchantId={merchantId}
                bankAddress={data.bankAddress}
                isManager={data.isManager && canOnchain}
                isOpen={data.isOpen ?? false}
                vatApplicable={data.vatApplicable}
                tokens={data.tokens}
                onAddFunds={onAddFunds}
                isWalletless={isWalletless}
            />
            {isWalletless && <LinkWalletNotice />}
        </Stack>
    );
}

function SetupBudget({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const {
        mutate: syncBank,
        isPending,
        isError,
    } = useSyncMerchantBank({ merchantId });

    return (
        <Card radius="m">
            <Stack space="xs">
                <Text variant="body" color="secondary">
                    {t("funding.setup.description")}
                </Text>
                <Button
                    size="large"
                    width="auto"
                    loading={isPending}
                    disabled={isPending}
                    onClick={() => syncBank()}
                >
                    {t("funding.setup.cta")}
                </Button>
                <ActionFeedback
                    isPending={isPending}
                    isError={isError}
                    pendingText={t("funding.setup.pending")}
                />
            </Stack>
        </Card>
    );
}

function BudgetContent({
    merchantId,
    bankAddress,
    isManager,
    isOpen,
    vatApplicable,
    tokens,
    onAddFunds,
    isWalletless,
}: {
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isOpen: boolean;
    vatApplicable: boolean;
    tokens: BudgetToken[];
    onAddFunds: () => void;
    isWalletless: boolean;
}) {
    const { t } = useTranslation();
    const { funded, empty } = splitTokensByFunding(tokens);
    const allTokensEmpty = funded.length === 0;

    return (
        <Stack space="l">
            <LegacyBankMigration
                merchantId={merchantId}
                newBankAddress={bankAddress}
            />

            {allTokensEmpty && (
                <Text variant="body" color="secondary">
                    {t("funding.budget.intro")}
                </Text>
            )}

            {allTokensEmpty && isOpen && (
                <CallOut variant="warning">
                    {t("funding.budget.emptyWarning")}
                </CallOut>
            )}

            <Stack space="xs">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    as="span"
                >
                    {t("funding.budget.sectionLabel")}
                </Text>

                {isManager && (
                    <DistributionCell
                        merchantId={merchantId}
                        bankAddress={bankAddress}
                        isOpen={isOpen}
                    />
                )}
                {!isManager && isWalletless && (
                    <Text variant="caption" color="secondary">
                        {t("funding.budget.walletlessPayRewards")}
                    </Text>
                )}
            </Stack>

            {funded.length > 0 && (
                <Stack space="m">
                    {funded.map((token) => (
                        <FundedTokenCard
                            key={token.address}
                            token={token}
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isManager={isManager}
                            isBankOpen={isOpen}
                            vatApplicable={vatApplicable}
                        />
                    ))}
                </Stack>
            )}

            {empty.length > 0 && (
                <Inline space="m" alignY="top" wrap={false}>
                    {empty.map((token) => (
                        <EmptyTokenCard key={token.address} token={token} />
                    ))}
                </Inline>
            )}

            <Inline space="none" align="center">
                <Button
                    size="large"
                    width="auto"
                    icon={<PlusIcon width={24} height={24} />}
                    onClick={onAddFunds}
                >
                    {t("funding.budget.addFunds")}
                </Button>
            </Inline>
        </Stack>
    );
}

function DistributionCell({
    merchantId,
    bankAddress,
    isOpen,
}: {
    merchantId: string;
    bankAddress: Address;
    isOpen: boolean;
}) {
    const { t } = useTranslation();
    const { setOpenStatus, isSettingOpenStatus, isOpenStatusError } =
        useSetBankOpenStatus({
            bankAddress,
            merchantId,
        });

    return (
        <Stack space="xxs">
            <div className={styles.cell}>
                <Text variant="body" weight="medium" color="primary" as="span">
                    {t("funding.budget.distributing")}
                </Text>
                <Switch
                    aria-label={t("funding.budget.distributing")}
                    checked={isOpen}
                    disabled={isSettingOpenStatus}
                    onCheckedChange={(checked) =>
                        setOpenStatus({ isOpen: checked })
                    }
                />
            </div>
            <Text variant="caption" color="secondary">
                {isOpen
                    ? t("funding.budget.distributingHintOn")
                    : t("funding.budget.distributingHintOff")}
            </Text>
            <ActionFeedback
                isPending={isSettingOpenStatus}
                isError={isOpenStatusError}
            />
        </Stack>
    );
}
